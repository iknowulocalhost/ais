import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * Привязка пользователя АИС к сотруднику в Сетевом ПОО.
 *
 * Ставит/снимает `users.netschool_employee_id`. Используется админами для выдачи
 * TEA-доступа к группам, в которых пользователь является классным руководителем.
 *
 * После изменения этого поля пользователь должен **перелогиниться** —
 * `netschoolEmployeeId` едет в JWT, и старый токен будет содержать прежнее значение.
 */
@Injectable()
export class SetUserNetschoolEmployeeUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(userId: string, netschoolEmployeeId: number | null): Promise<{ ok: true }> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (netschoolEmployeeId !== null && (!Number.isInteger(netschoolEmployeeId) || netschoolEmployeeId <= 0)) {
      throw new BadRequestException('netschoolEmployeeId должен быть положительным целым или null');
    }

    const oldValue = user.netschoolEmployeeId;
    user.netschoolEmployeeId = netschoolEmployeeId;
    user.updatedAt = new Date();
    await this.users.update(user);

    await this.audit.record({
      ctx,
      action: 'ROLE_CHANGE',
      entity: 'User',
      entityId: user.id,
      oldState: { netschoolEmployeeId: oldValue },
      newState: { netschoolEmployeeId },
    });

    return { ok: true };
  }
}
