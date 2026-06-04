import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  MAX_LINK_TOKEN_REPOSITORY,
  MaxLinkTokenRepository,
} from '../../../domain/repositories/max-link-token.repository';
import { AuditService, AuditContext } from '../../services/audit.service';

/** POST /api/integrations/max/link — привязка MAX chat_id по one-time токену. */
@Injectable()
export class LinkMaxAccountUseCase {
  private readonly logger = new Logger(LinkMaxAccountUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(MAX_LINK_TOKEN_REPOSITORY)
    private readonly tokens: MaxLinkTokenRepository,
    private readonly audit: AuditService,
  ) {}

  async execute(
    rawToken: string,
    maxChatId: string,
    maxFio: string | null,
    ctx: AuditContext,
  ): Promise<LinkMaxAccountResult> {
    const token = (rawToken ?? '').trim();
    const chatId = (maxChatId ?? '').trim();
    if (!token || !chatId) {
      throw new BadRequestException('token и maxChatId обязательны');
    }
    if (!/^[0-9a-f]{32,64}$/i.test(token)) {
      throw new BadRequestException('Некорректный формат токена');
    }
    if (!/^-?\d{1,32}$/.test(chatId)) {
      throw new BadRequestException('Некорректный формат maxChatId');
    }

    const row = await this.tokens.findByToken(token);
    if (!row) throw new NotFoundException('Токен не найден');
    if (row.usedAt) throw new GoneException('Токен уже использован');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Токен просрочен');
    }

    const user = await this.users.findById(row.userId);
    if (!user) throw new NotFoundException('Пользователь не найден');

    const existing = await this.users.findByMaxChatId(chatId);
    if (existing && existing.id !== user.id) {
      throw new ConflictException(
        'Этот MAX-аккаунт уже привязан к другой учётной записи АИС',
      );
    }

    user.maxChatId = chatId;
    user.maxLinkPromptSkipCount = 0; // сброс счётчика — privacy clean
    await this.users.update(user);
    await this.tokens.markUsed(token);

    await this.audit.record({
      ctx: { ...ctx, actorId: user.id },
      action: 'LINK_MAX_ACCOUNT',
      entity: 'User',
      entityId: user.id,
      meta: { maxFio: maxFio ?? undefined },
    });

    this.logger.log(`MAX linked: user ${user.id} ↔ chat ${chatId}`);

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      email: user.email,
      roles: user.roles,
    };
  }
}

export interface LinkMaxAccountResult {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string;
  roles: string[];
}
