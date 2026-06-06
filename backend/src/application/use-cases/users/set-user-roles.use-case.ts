import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import { Role } from '../../../domain/enums/role.enum';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/** PATCH /users/:id/roles. Защита: нельзя снять SUPERADMIN с себя, грант SUPERADMIN — только от SUPERADMIN. */
@Injectable()
export class SetUserRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(
    targetUserId: string,
    nextRoles: Role[],
    actor: { id: string; roles: Role[] },
  ): Promise<{ ok: true; roles: Role[] }> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    if (!Array.isArray(nextRoles) || nextRoles.length === 0) {
      throw new BadRequestException('Список ролей не может быть пустым');
    }
    const cleaned = Array.from(new Set(nextRoles));
    for (const r of cleaned) {
      if (!Object.values(Role).includes(r)) {
        throw new BadRequestException(`Неизвестная роль: ${r}`);
      }
    }

    const target = await this.users.findById(targetUserId);
    if (!target) throw new NotFoundException('Пользователь не найден');

    const oldRoles = [...target.roles];

    const removingSuperFromSelf =
      target.id === actor.id &&
      oldRoles.includes(Role.SUPERADMIN) &&
      !cleaned.includes(Role.SUPERADMIN);
    if (removingSuperFromSelf) {
      throw new ForbiddenException('Нельзя снять с себя роль SUPERADMIN');
    }

    const grantingSuper = !oldRoles.includes(Role.SUPERADMIN) && cleaned.includes(Role.SUPERADMIN);
    if (grantingSuper && !actor.roles.includes(Role.SUPERADMIN)) {
      throw new ForbiddenException('Назначить SUPERADMIN может только SUPERADMIN');
    }

    target.roles = cleaned;
    target.updatedAt = new Date();
    await this.users.update(target);

    await this.audit.record({
      ctx,
      action: 'ROLE_CHANGE',
      entity: 'User',
      entityId: target.id,
      oldState: { roles: oldRoles },
      newState: { roles: cleaned },
    });

    return { ok: true, roles: cleaned };
  }
}
