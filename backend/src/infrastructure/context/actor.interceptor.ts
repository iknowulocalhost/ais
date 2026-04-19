import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { RequestContext } from './request-context';
import type { AuthenticatedUser } from '../../presentation/http/auth/jwt.strategy';

/**
 * Дополняет RequestContext actorId из JWT (после JwtAuthGuard).
 * Для @Public()-эндпоинтов user === undefined — actorId останется null.
 */
@Injectable()
export class ActorInterceptor implements NestInterceptor {
  constructor(private readonly ctx: RequestContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (req.user) {
      const current = this.ctx.get();
      // Мутация store текущего AsyncLocalStorage-сегмента: допустимо, т.к. AuditContext — POJO.
      Object.assign(current, { actorId: req.user.id });
    }
    return next.handle();
  }
}
