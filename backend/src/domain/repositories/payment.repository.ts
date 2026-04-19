import { Payment, PaymentStatus } from '../entities/payment.entity';

export interface PaymentFilter {
  studentId?: string;
  status?: PaymentStatus;
  from?: Date;
  to?: Date;
}

export abstract class PaymentRepository {
  abstract findById(id: string): Promise<Payment | null>;
  abstract create(p: Payment): Promise<Payment>;
  abstract update(p: Payment): Promise<Payment>;
  abstract list(filter: PaymentFilter, limit: number, offset: number): Promise<{ items: Payment[]; total: number }>;
  abstract sumPaidByStudent(studentId: string): Promise<bigint>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
