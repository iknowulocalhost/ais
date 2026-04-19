import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReportKind, ReportStatus } from '../../../domain/entities/report-export.entity';

@Entity({ name: 'report_exports' })
@Index('ix_reports_user', ['requestedBy'])
export class ReportExportOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: ReportKind;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  params!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'QUEUED' })
  status!: ReportStatus;

  @Column({ name: 'object_key', type: 'varchar', length: 512, nullable: true })
  objectKey!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
