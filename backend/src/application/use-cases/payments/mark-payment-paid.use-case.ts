import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PAYMENT_REPOSITORY,
  PaymentRepository,
} from '../../../domain/repositories/payment.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

@Injectable()
export class MarkPaymentPaidUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(paymentId: string, externalRef: string | null): Promise<void> {
    const p = await this.payments.findById(paymentId);
    if (!p) throw new NotFoundException();

    const oldState = { status: p.status, paidAt: p.paidAt, externalRef: p.externalRef };
    p.markPaid(externalRef);
    await this.payments.update(p);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'UPDATE',
      entity: 'Payment',
      entityId: p.id,
      oldState,
      newState: { status: p.status, paidAt: p.paidAt, externalRef: p.externalRef },
    });
  }
}
