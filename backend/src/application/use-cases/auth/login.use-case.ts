import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../../domain/services/password-hasher';
import {
  REFRESH_TOKEN_STORE,
  RefreshTokenStore,
} from '../../../domain/services/refresh-token-store';
import { Role } from '../../../domain/enums/role.enum';
import { AuditService, AuditContext } from '../../services/audit.service';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  roles: Role[];
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: Role[];
  };
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshStore: RefreshTokenStore,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async execute(email: string, password: string, ctx: AuditContext): Promise<LoginResult> {
    const user = await this.users.findByEmail(email.toLowerCase().trim());

    // Timing-attack mitigation: сверяем хеш даже если пользователя нет.
    const hashToVerify =
      user?.passwordHash ??
      '$argon2id$v=19$m=19456,t=2,p=1$ZmFrZXNhbHRmYWtlc2FsdA$fakehashfakehashfakehashfakehashfakehashfake';
    const valid = await this.hasher.verify(hashToVerify, password);

    if (!user || !valid || !user.isActive) {
      await this.audit.record({
        ctx,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? null,
        meta: { email: email.toLowerCase().trim(), reason: !user ? 'not_found' : !valid ? 'bad_password' : 'inactive' },
      });
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, roles: user.roles } as JwtAccessPayload,
      {
        secret: this.cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.cfg.get<string>('JWT_ACCESS_TTL', '15m'),
      },
    );

    const jti = randomUUID();
    const refreshTtl = this.cfg.get<string>('JWT_REFRESH_TTL', '7d');
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti } as JwtRefreshPayload,
      {
        secret: this.cfg.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    await this.refreshStore.save(user.id, jti, refreshToken, parseTtlToSeconds(refreshTtl));

    user.recordLogin();
    await this.users.update(user);

    await this.audit.record({
      ctx: { ...ctx, actorId: user.id },
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      meta: { jti },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
    };
  }
}

/** "15m" | "7d" | "3600" → секунды. */
export function parseTtlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default:  return n;
  }
}
