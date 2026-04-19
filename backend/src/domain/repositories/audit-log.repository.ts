import { AuditLog } from '../entities/audit-log.entity';

export abstract class AuditLogRepository {
  abstract append(entry: AuditLog): Promise<void>;
  abstract findByEntity(entity: string, entityId: string, limit?: number): Promise<AuditLog[]>;
  abstract findByActor(actorId: string, limit?: number): Promise<AuditLog[]>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
