/**
 * Запись журнала аудита.
 * Хранится в TimescaleDB hypertable (по ts).
 * Требования 152-ФЗ: фиксация субъекта, действия, IP-адреса, состояний ДО/ПОСЛЕ.
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'ROLE_CHANGE'
  | 'READ_SENSITIVE'
  | 'HTTP_REQUEST'
  | 'SECURITY_ALERT';

export class AuditLog {
  constructor(
    public readonly ts: Date,
    public readonly actorId: string | null, // null — анонимная попытка (напр. LOGIN_FAILED)
    public readonly action: AuditAction,
    public readonly entity: string,         // например 'User', 'Student', 'Application'
    public readonly entityId: string | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly oldState: Record<string, unknown> | null,
    public readonly newState: Record<string, unknown> | null,
    public readonly meta: Record<string, unknown> | null = null,
  ) {}
}
