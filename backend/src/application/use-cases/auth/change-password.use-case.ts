import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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
import { AuditContext, AuditService } from '../../services/audit.service';

/**
 * Смена пароля. После успешной смены отзываются ВСЕ refresh-токены пользователя —
 * он должен залогиниться заново на всех устройствах.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshStore: RefreshTokenStore,
    private readonly audit: AuditService,
  ) {}

  async execute(userId: string, oldPassword: string, newPassword: string, ctx: AuditContext): Promise<void> {
    if (newPassword.length < 10) {
      throw new BadRequestException('Пароль должен быть не короче 10 символов');
    }

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const ok = await this.hasher.verify(user.passwordHash, oldPassword);
    if (!ok) throw new UnauthorizedException('Неверный текущий пароль');

    user.passwordHash = await this.hasher.hash(newPassword);
    user.updatedAt = new Date();
    await this.users.update(user);

    await this.refreshStore.revokeAll(userId);

    await this.audit.record({
      ctx,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: userId,
    });
  }
}
