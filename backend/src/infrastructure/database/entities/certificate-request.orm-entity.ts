import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CertificateStatus,
  CertificateType,
} from '../../../domain/entities/certificate-request.entity';

@Entity({ name: 'certificate_requests' })
@Index('ix_cert_status', ['status'])
@Index('ix_cert_type', ['certType'])
export class CertificateRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Человекочитаемый номер справки. Заполняется sequence в БД (см. миграцию),
   * поэтому в TypeORM колонка помечена как generated.
   */
  @Column({
    name: 'display_no',
    type: 'integer',
    nullable: false,
    insert: false,
    update: false,
  })
  displayNo!: number;

  @Column({ name: 'cert_type', type: 'varchar', length: 16 })
  certType!: CertificateType;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate!: Date;

  @Column({ name: 'group_name', type: 'varchar', length: 50 })
  groupName!: string;

  @Column({ name: 'target_org', type: 'varchar', length: 255 })
  targetOrg!: string;

  @Column({ type: 'varchar', length: 32 })
  phone!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'period_from', type: 'date', nullable: true })
  periodFrom!: Date | null;

  @Column({ name: 'period_to', type: 'date', nullable: true })
  periodTo!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status!: CertificateStatus;

  @Column({ name: 'status_comment', type: 'varchar', length: 500, nullable: true })
  statusComment!: string | null;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId!: string | null;

  @Column({ name: 'max_user_id', type: 'varchar', length: 64, nullable: true })
  maxUserId!: string | null;

  @Column({ name: 'submitter_user_id', type: 'uuid', nullable: true })
  submitterUserId!: string | null;

  @Column({ name: 'full_name_dat', type: 'varchar', length: 300, nullable: true })
  fullNameDat!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
