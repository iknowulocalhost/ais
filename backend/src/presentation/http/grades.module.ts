import { Module } from '@nestjs/common';
import { GradesController } from './controllers/grades.controller';
import { CreateGradeSheetUseCase } from '../../application/use-cases/grades/create-grade-sheet.use-case';
import { SubmitGradesUseCase } from '../../application/use-cases/grades/submit-grades.use-case';
import { CloseGradeSheetUseCase } from '../../application/use-cases/grades/close-grade-sheet.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [GradesController],
  providers: [
    CreateGradeSheetUseCase,
    SubmitGradesUseCase,
    CloseGradeSheetUseCase,
    AuditService,
  ],
})
export class GradesModule {}
