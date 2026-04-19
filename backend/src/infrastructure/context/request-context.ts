import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { AuditContext } from '../../application/services/audit.service';

/**
 * Сквозной контекст запроса на AsyncLocalStorage.
 * Позволяет use-cases и AuditService вытягивать actorId/ip/UA без прокидывания
 * ctx через каждый слой. Инициализируется в ContextMiddleware.
 */
@Injectable()
export class RequestContext {
  private readonly als = new AsyncLocalStorage<AuditContext>();

  run<T>(ctx: AuditContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  get(): AuditContext {
    return this.als.getStore() ?? { actorId: null, ipAddress: null, userAgent: null };
  }

  withActor(actorId: string): AuditContext {
    const base = this.get();
    return { ...base, actorId };
  }
}
