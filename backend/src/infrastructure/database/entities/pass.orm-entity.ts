import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Hostel, PassStatus } from '../../../domain/entities/pass.entity';

@Entity({ name: 'passes' })
@Index('ix_passes_status', ['status'])
export class PassOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'group_or_position', type: 'varchar', length: 100 })
  groupOrPosition!: string;

  @Column({ type: 'varchar', length: 8, default: 'NONE' })
  hostel!: Hostel;

  @Column({ name: 'ticket_key', type: 'varchar', length: 512, nullable: true })
  ticketKey!: string | null;

  @Column({ name: 'max_user_id', type: 'varchar', length: 64, nullable: true })
  maxUserId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status!: PassStatus;

  @Column({ name: 'status_comment', type: 'varchar', length: 500, nullable: true })
  statusComment!: string | null;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId!: string | null;

  @Column({ name: 'submitter_user_id', type: 'uuid', nullable: true })
  submitterUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
