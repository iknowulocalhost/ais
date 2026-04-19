import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsController } from './controllers/reports.controller';
import { RequestExportUseCase } from '../../application/use-cases/reports/request-export.use-case';
import { AuditService } from '../../application/services/audit.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.REPORT_EXPORT })],
  controllers: [ReportsController],
  providers: [RequestExportUseCase, AuditService],
})
export class ReportsModule {}
