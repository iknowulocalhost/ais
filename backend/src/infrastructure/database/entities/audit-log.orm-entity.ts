import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * ORM-маппинг hypertable audit_logs (TimescaleDB).
 * Первичный ключ — композитный (ts, id), т.к. hypertable требует time-колонку в PK.
 */
@Entity({ name: 'audit_logs' })
@Index('ix_audit_entity', ['entity', 'entityId'])
@Index('ix_audit_actor', ['actorId'])
export class AuditLogOrmEntity {
  @PrimaryColumn({ type: 'timestamptz' })
  ts!: Date;

  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'varchar', length: 64 })
  entity!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId!: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'old_state', type: 'jsonb', nullable: true })
  oldState!: Record<string, unknown> | null;

  @Column({ name: 'new_state', type: 'jsonb', nullable: true })
  newState!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;
}
