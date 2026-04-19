import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../../domain/repositories/payment.repository';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import { Payment, PaymentPurpose } from '../../../domain/entities/payment.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface CreatePaymentInput {
  studentId: string;
  purpose: PaymentPurpose;
  amountKopecks: string | number | bigint; // принимаем как строку из JSON (bigint безопасно)
  dueDate: string; // ISO
  comment?: string | null;
}

@Injectable()
export class CreatePaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: CreatePaymentInput): Promise<Payment> {
    const amount = BigInt(input.amountKopecks as never);
    if (amount <= 0n) throw new BadRequestException('Сумма должна быть > 0 копеек');

    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundException('Студент не найден');

    const now = new Date();
    const p = new Payment(
      randomUUID(),
      student.id,
      input.purpose,
      amount,
      'RUB',
      'PENDING',
      new Date(input.dueDate),
      null,
      null,
      input.comment ?? null,
      now,
      now,
    );
    const saved = await this.payments.create(p);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'Payment',
      entityId: saved.id,
      newState: {
        studentId: saved.studentId,
        purpose: saved.purpose,
        amountKopecks: saved.amountKopecks.toString(),
        currency: saved.currency,
        status: saved.status,
        dueDate: saved.dueDate,
      },
    });
    return saved;
  }
}
