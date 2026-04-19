import { Module } from '@nestjs/common';
import { ApplicationsController } from './controllers/applications.controller';
import { SubmitApplicationUseCase } from '../../application/use-cases/applications/submit-application.use-case';
import { ListApplicationsUseCase } from '../../application/use-cases/applications/list-applications.use-case';
import { ReviewApplicationUseCase } from '../../application/use-cases/applications/review-application.use-case';
import { BatchEnrollUseCase } from '../../application/use-cases/applications/batch-enroll.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [ApplicationsController],
  providers: [
    SubmitApplicationUseCase,
    ListApplicationsUseCase,
    ReviewApplicationUseCase,
    BatchEnrollUseCase,
    AuditService,
  ],
})
export class ApplicationsModule {}
