import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicantStatus } from '../../../domain/entities/applicant.entity';

@Entity({ name: 'applicants' })
@Index('ix_applicants_status', ['status'])
@Index('ix_applicants_created_by', ['createdById'])
export class ApplicantOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status!: ApplicantStatus;

  /**
   * Зашифрованный payload (AES-256-GCM): [iv(12)] || [tag(16)] || [ciphertext].
   * Никогда не возвращается в API в сыром виде.
   */
  @Column({ name: 'payload_cipher', type: 'bytea' })
  payloadCipher!: Buffer;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
