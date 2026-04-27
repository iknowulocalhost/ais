import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditService } from '../../application/services/audit.service';
import { SecurityAlertService } from '../../application/services/security-alert.service';
import { RequestContext } from './request-context';

/**
 * Перехватывает 401/403 (от Guards) и пишет их в audit_logs.
 * Сами Guards выполняются до Interceptors, поэтому HttpAuditInterceptor
 * такие отказы не видит — нужен отдельный фильтр.
 */
@Catch(UnauthorizedException, ForbiddenException)
export class AuditDeniedFilter implements ExceptionFilter {
  constructor(
    private readonly audit: AuditService,
    private readonly ctx: RequestContext,
    private readonly alerts: SecurityAlertService,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const status = exception.getStatus();
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
        denied: status === 401 ? 'unauthorized' : 'forbidden',
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

    res.status(status).json(exception.getResponse());
  }
}
