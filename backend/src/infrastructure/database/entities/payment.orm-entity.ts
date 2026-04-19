import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentPurpose, PaymentStatus } from '../../../domain/entities/payment.entity';

/**
 * Хранение сумм: bigint копеек. Node driver отдаёт bigint как string → трансформер.
 */
const bigintTransformer = {
  to: (v: bigint | number | null) => (v === null || v === undefined ? null : v.toString()),
  from: (v: string | null) => (v === null ? null : BigInt(v)),
};

@Entity({ name: 'payments' })
@Index('ix_payments_student', ['studentId'])
@Index('ix_payments_status', ['status'])
export class PaymentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ type: 'varchar', length: 32 })
  purpose!: PaymentPurpose;

  @Column({ name: 'amount_kopecks', type: 'bigint', transformer: bigintTransformer })
  amountKopecks!: bigint;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency!: string;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status!: PaymentStatus;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'external_ref', type: 'varchar', length: 128, nullable: true })
  externalRef!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
