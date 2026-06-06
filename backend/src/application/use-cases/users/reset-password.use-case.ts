import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../../domain/services/password-hasher';
import { PasswordGenerator } from '../../services/password-generator';
import { AuditService } from '../../services/audit.service';
import { NotifyService } from '../../services/notify.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * Сброс пароля пользователю и одноразовая выдача нового plaintext-значения.
 *
 * Возвращает свежий пароль ровно один раз — именно его админ показывает студенту
 * (распечатка/смс/устно). В аудит уходит только факт сброса; сам пароль никогда
 * не попадает ни в логи, ни в `audit_log`.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly generator: PasswordGenerator,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(userId: string): Promise<{ password: string; email: string }> {
    const ctx = this.reqCtx.get();

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');

    const password = this.generator.generate(12);
    user.passwordHash = await this.hasher.hash(password);
    user.updatedAt = new Date();
    await this.users.update(user);

    await this.audit.record({
      ctx,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: user.id,
      newState: { byActor: ctx.actorId, at: user.updatedAt },
    });

    // Пароль в MAX НЕ шлём (канал записывается в audit_log + БД outbox).
    // Только факт сброса — пусть пользователь спросит у админа лично.
    await this.notify.enqueue({
      userId: user.id,
      to: user.email,
      subject: 'Пароль АИС сброшен',
      text:
        'Администратор сбросил ваш пароль в АИС. ' +
        'Новый пароль выдан вам отдельно — устно или в распечатке. ' +
        'Если вы пароль не получали — обратитесь к администратору.',
    });

    return { password, email: user.email };
  }
}
