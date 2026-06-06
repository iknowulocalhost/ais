import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  MAX_LINK_TOKEN_REPOSITORY,
  MaxLinkTokenRepository,
} from '../../../domain/repositories/max-link-token.repository';
import { AuditService, AuditContext } from '../../services/audit.service';

/** Создать one-time токен MAX-привязки. TTL 10 мин; возвращает токен + deep-link. */
@Injectable()
export class CreateMaxLinkTokenUseCase {
  private static readonly TTL_MS = 10 * 60 * 1000;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(MAX_LINK_TOKEN_REPOSITORY)
    private readonly tokens: MaxLinkTokenRepository,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async execute(userId: string, ctx: AuditContext): Promise<CreateMaxLinkTokenResult> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');

    void this.tokens.deleteExpiredForUser(userId).catch(() => undefined);

    const token = randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CreateMaxLinkTokenUseCase.TTL_MS);

    await this.tokens.create({ token, userId: user.id, expiresAt, createdAt: now, usedAt: null });

    const botUsername = this.cfg.get<string>('MAX_BOT_USERNAME', '');
    const deepLink = botUsername
      ? `https://max.ru/${botUsername}?start=link_${token}`
      : null;

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'MaxLinkToken',
      entityId: null,
      meta: { ttlMinutes: 10, hasDeepLink: !!deepLink },
    });

    return { token, deepLink, expiresAt };
  }
}

export interface CreateMaxLinkTokenResult {
  token: string;
  /** null если MAX_BOT_USERNAME не задан — клиент покажет токен вручную. */
  deepLink: string | null;
  expiresAt: Date;
}
