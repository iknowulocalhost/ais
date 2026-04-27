import { AuditLog } from '../entities/audit-log.entity';

export interface AuditFilter {
  from?: Date;
  to?: Date;
  actorId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  search?: string;
}

export abstract class AuditLogRepository {
  abstract append(entry: AuditLog): Promise<void>;
  abstract findByEntity(entity: string, entityId: string, limit?: number): Promise<AuditLog[]>;
  abstract findByActor(actorId: string, limit?: number): Promise<AuditLog[]>;
  abstract find(
    filter: AuditFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: AuditLog[]; total: number }>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
