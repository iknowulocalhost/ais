import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  REFRESH_TOKEN_STORE,
  RefreshTokenStore,
} from '../../../domain/services/refresh-token-store';
import { AuditService, AuditContext } from '../../services/audit.service';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
  LoginResult,
  parseTtlToSeconds,
} from './login.use-case';

/**
 * Refresh с ротацией: старый jti отзывается, выдаётся новая пара.
 * Если refresh не найден в Redis — компрометация: отзываем все сессии пользователя.
 */
@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshStore: RefreshTokenStore,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async execute(refreshToken: string, ctx: AuditContext): Promise<LoginResult> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.cfg.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Невалидный refresh-токен');
    }

    const stillValid = await this.refreshStore.exists(payload.sub, payload.jti, refreshToken);
    if (!stillValid) {
      await this.refreshStore.revokeAll(payload.sub);
      await this.audit.record({
        ctx: { ...ctx, actorId: payload.sub },
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: payload.sub,
        meta: { reason: 'refresh_reuse_or_revoked', jti: payload.jti },
      });
      throw new UnauthorizedException('Сессия отозвана');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      await this.refreshStore.revokeAll(payload.sub);
      throw new UnauthorizedException('Пользователь недоступен');
    }

    // Ротация: отзываем старый jti, создаём новый.
    await this.refreshStore.revoke(payload.sub, payload.jti);

    const newJti = randomUUID();
    const refreshTtl = this.cfg.get<string>('JWT_REFRESH_TTL', '7d');

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        // КРИТИЧНО: без этого поля после первого refresh'а (через ~15 мин после
        // логина) пропадает привязка TEA к сотруднику Сетевого ПОО — RolesGuard
        // и allowedGroupIds читают netschoolEmployeeId из JWT и для TEA без
        // него возвращают «нет групп». Бывший баг: после привязки employee_id
        // в админке роли подтягивались, а группа исчезала через 15 мин.
        netschoolEmployeeId: user.netschoolEmployeeId,
      } as JwtAccessPayload,
      {
        secret: this.cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.cfg.get<string>('JWT_ACCESS_TTL', '15m'),
      },
    );
    const newRefreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: newJti } as JwtRefreshPayload,
      {
        secret: this.cfg.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );
    await this.refreshStore.save(user.id, newJti, newRefreshToken, parseTtlToSeconds(refreshTtl));

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        netschoolEmployeeId: user.netschoolEmployeeId,
      },
    };
  }
}
