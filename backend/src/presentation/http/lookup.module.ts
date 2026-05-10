import { Module } from '@nestjs/common';
import { LookupController } from './controllers/lookup.controller';
import { OrderLookupService } from '../../application/services/order-lookup.service';
import { GetStudentDetailUseCase } from '../../application/use-cases/poozabedu/get-student-detail.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [LookupController],
  providers: [OrderLookupService, GetStudentDetailUseCase, AuditService],
})
export class LookupModule {}
