import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../domain/enums/role.enum';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedUser } from './jwt.strategy';

/**
 * RBAC: пропускает, если у пользователя есть хотя бы одна из требуемых ролей.
 * SUPERADMIN получает доступ всегда.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Не авторизован');

    if (user.roles.includes(Role.SUPERADMIN)) return true;
    if (user.roles.some((r) => required.includes(r))) return true;

    throw new ForbiddenException('Недостаточно прав');
  }
}
