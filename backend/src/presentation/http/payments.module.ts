import { Module } from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller';
import { CreatePaymentUseCase } from '../../application/use-cases/payments/create-payment.use-case';
import { MarkPaymentPaidUseCase } from '../../application/use-cases/payments/mark-payment-paid.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [PaymentsController],
  providers: [CreatePaymentUseCase, MarkPaymentPaidUseCase, AuditService],
})
export class PaymentsModule {}
