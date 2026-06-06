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
import {
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import { Role } from '../../../domain/enums/role.enum';
import { AuditService, AuditContext } from '../../services/audit.service';
import { Logger } from '@nestjs/common';
import { LdapLoginUseCase } from './ldap-login.use-case';
import { User } from '../../../domain/entities/user.entity';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  roles: Role[];
  /**
   * ID сотрудника в Сетевом ПОО, привязанный к аккаунту АИС (если есть).
   * Используется для RBAC роли TEA, чтобы ограничить доступ к группам, в которых
   * пользователь является классным руководителем. Прокладывается в JWT, чтобы
   * guard'ы не лезли за этим в БД на каждом запросе.
   */
  netschoolEmployeeId: number | null;
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
    netschoolEmployeeId: number | null;
  };
}

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshStore: RefreshTokenStore,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly mirrorStudents: PoozabeduStudentRepository,
    private readonly ldap: LdapLoginUseCase,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async execute(login: string, password: string, ctx: AuditContext): Promise<LoginResult> {
    // Решаем, как трактовать введённый «логин»:
    //  - есть '@' → email, идём в локальную авторизацию;
    //  - нет '@' → доменный sAMAccountName, идём в LDAP (если включён).
    // На случай если LDAP-учётке завели локальный email — после LDAP-фейла
    // упадём обратно в локальную ветку.
    const trimmed = login.trim();
    const looksLikeSam = !trimmed.includes('@');
    let user: User | null = null;
    let via: 'local' | 'ldap' = 'local';

    if (looksLikeSam && this.ldap.isEnabled()) {
      const profile = await this.ldap.tryAuthenticate(trimmed, password);
      if (profile) {
        user = await this.ldap.upsertFromLdap(profile);
        via = 'ldap';
      }
    }

    // Fallback: либо ввели email, либо LDAP не сработал.
    if (!user) {
      const candidate = await this.users.findByEmail(trimmed.toLowerCase());

      // Timing-attack mitigation: сверяем хеш даже если пользователя нет.
      const hashToVerify =
        candidate?.passwordHash ??
        '$argon2id$v=19$m=19456,t=2,p=1$ZmFrZXNhbHRmYWtlc2FsdA$fakehashfakehashfakehashfakehashfakehashfake';
      const valid = await this.hasher.verify(hashToVerify, password);
      if (candidate && valid && candidate.isActive) {
        user = candidate;
      } else {
        // Аудит-причина намеренно одна и та же для всех негативных исходов
        // («нет пользователя», «неверный пароль», «деактивирован»). Иначе
        // админ или взломщик, читающий audit_log, смог бы по reason понять,
        // что логин подобран верно — это сильно облегчает брутфорс.
        // Деактивацию учётки фиксируем отдельно, после успешной проверки пароля.
        await this.audit.record({
          ctx,
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: null,
          meta: { login: trimmed.toLowerCase(), looksLikeSam },
        });
        throw new UnauthorizedException('Неверный логин или пароль');
      }
    }

    if (!user.isActive) {
      // Здесь пароль уже проверен корректно — поэтому отдельное событие,
      // чтобы админ видел: «вот человек с правильным паролем пытается войти,
      // но его аккаунт отключён». Это уже не утечка — логин подтверждён.
      await this.audit.record({
        ctx,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        meta: { reason: 'inactive' },
      });
      throw new UnauthorizedException('Учётная запись отключена');
    }

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        netschoolEmployeeId: user.netschoolEmployeeId,
      } as JwtAccessPayload,
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

    // Авто-привязка STU-аккаунта к студенту из зеркала Сетевого ПОО.
    // Срабатывает, если аккаунт создан вручную через /admin/users/new (без
    // явной привязки), но ФИО совпадает с одним конкретным студентом в зеркале.
    // Если совпадений несколько (полные тёзки) — оставляем `null`, админ
    // привяжет руками. Любая ошибка глотается — логин не должен падать из-за
    // вспомогательной операции.
    if (
      user.roles.includes(Role.STU) &&
      user.studentExternalId === null
    ) {
      try {
        const candidates = await this.mirrorStudents.findByFullName(
          user.lastName,
          user.firstName,
          user.middleName,
        );
        if (candidates.length === 1) {
          user.studentExternalId = candidates[0].externalId;
          this.logger.log(
            `auto-link STU ${user.id} → poozabedu student #${candidates[0].externalId} (${user.lastName} ${user.firstName})`,
          );
        } else if (candidates.length > 1) {
          this.logger.warn(
            `auto-link skipped: ${candidates.length} однофамильцев для ${user.lastName} ${user.firstName}`,
          );
        }
      } catch (e) {
        this.logger.warn(`auto-link error: ${(e as Error).message}`);
      }
    }

    user.recordLogin();
    await this.users.update(user);

    await this.audit.record({
      ctx: { ...ctx, actorId: user.id },
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      meta: { jti, via },
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
        netschoolEmployeeId: user.netschoolEmployeeId,
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
