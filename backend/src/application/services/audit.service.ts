import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { AuditAction, AuditLog } from '../../domain/entities/audit-log.entity';

export interface AuditContext {
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repo: AuditLogRepository,
  ) {}

  async record(params: {
    ctx: AuditContext;
    action: AuditAction;
    entity: string;
    entityId: string | null;
    oldState?: Record<string, unknown> | null;
    newState?: Record<string, unknown> | null;
    meta?: Record<string, unknown> | null;
  }): Promise<void> {
    const entry = new AuditLog(
      new Date(),
      params.ctx.actorId,
      params.action,
      params.entity,
      params.entityId,
      params.ctx.ipAddress,
      params.ctx.userAgent,
      params.oldState ?? null,
      params.newState ?? null,
      params.meta ?? null,
    );
    try {
      await this.repo.append(entry);
    } catch (err) {
      // Аудит не должен ломать основной поток — но сбой обязателен к логированию.
      this.logger.error('Failed to persist audit log', err as Error);
    }
  }
}
