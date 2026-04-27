import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { AuditService } from '../../application/services/audit.service';
import { SecurityAlertService } from '../../application/services/security-alert.service';
import { RequestContext } from './request-context';

// /audit логируется специально — нужно знать, кто и когда смотрел журнал.
// Health/metrics/queues — служебные, иначе ушум.
const SKIP_PATHS = [/^\/health/, /^\/metrics/, /^\/queues/];

/**
 * Глобальный HTTP-интерсептор: пишет в audit_logs каждый запрос
 * (метод, путь, статус, длительность, actor, ip, UA).
 * Health/metrics/queues и сам /audit пропускаются — иначе бесконечный шум.
 */
@Injectable()
export class HttpAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly ctx: RequestContext,
    private readonly alerts: SecurityAlertService,
  ) {}

  intercept(ec: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ec.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (SKIP_PATHS.some((re) => re.test(req.path))) return next.handle();

    const start = Date.now();
    const log = (status: number, error?: string) => {
      const ctx = this.ctx.get();
      void this.audit.record({
        ctx,
        action: 'HTTP_REQUEST',
        entity: 'Request',
        entityId: null,
        meta: {
          method: req.method,
          path: req.path,
          status,
          durationMs: Date.now() - start,
          ...(error ? { error } : {}),
        },
      });
      this.alerts.observe({
        action: 'HTTP_REQUEST',
        status,
        path: req.path,
        actorId: ctx.actorId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    };

    return next.handle().pipe(
      tap(() => log(res.statusCode)),
      catchError((err) => {
        const status = (err as { status?: number })?.status ?? 500;
        log(status, (err as Error)?.message ?? String(err));
        throw err;
      }),
    );
  }
}
