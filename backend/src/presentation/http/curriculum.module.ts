import { Module } from '@nestjs/common';
import { CurriculumController } from './controllers/curriculum.controller';
import { CreateDisciplineUseCase } from '../../application/use-cases/curriculum/create-discipline.use-case';
import { CreateCurriculumPlanUseCase } from '../../application/use-cases/curriculum/create-curriculum-plan.use-case';
import { AddCurriculumEntryUseCase } from '../../application/use-cases/curriculum/add-curriculum-entry.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [CurriculumController],
  providers: [
    CreateDisciplineUseCase,
    CreateCurriculumPlanUseCase,
    AddCurriculumEntryUseCase,
    AuditService,
  ],
})
export class CurriculumModule {}
