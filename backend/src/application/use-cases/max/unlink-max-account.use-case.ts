import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import { AuditService, AuditContext } from '../../services/audit.service';

/**
 * Отвязать MAX-чат от учётки АИС. Вызывается из личного кабинета
 * (пользователь нажал «Отключить уведомления в МАХ»).
 *
 * Идемпотентно: если привязки нет — операция всё равно возвращает успех,
 * чтобы фронт не ловил лишних 4xx.
 */
@Injectable()
export class UnlinkMaxAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly audit: AuditService,
  ) {}

  async execute(userId: string, ctx: AuditContext): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (!user.maxChatId) return;
    const previous = user.maxChatId;
    user.maxChatId = null;
    await this.users.update(user);
    await this.audit.record({
      ctx,
      action: 'UNLINK_MAX_ACCOUNT',
      entity: 'User',
      entityId: user.id,
      meta: { previousChatId: previous },
    });
  }
}
