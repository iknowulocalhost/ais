import { Module } from '@nestjs/common';
import { PoozabeduApiController } from './controllers/poozabeduapi.controller';
import { SyncPoozabeduUseCase } from '../../application/use-cases/poozabedu/sync-poozabedu.use-case';
import { GetStudentDetailUseCase } from '../../application/use-cases/poozabedu/get-student-detail.use-case';
import { GetCollegeGpaUseCase } from '../../application/use-cases/poozabedu/get-college-gpa.use-case';
import { GetJournalUseCase } from '../../application/use-cases/poozabedu/get-journal.use-case';
import { GetScheduleUseCase } from '../../application/use-cases/poozabedu/get-schedule.use-case';
import { ListEmployeesUseCase } from '../../application/use-cases/poozabedu/list-employees.use-case';
import { GetReportUseCase } from '../../application/use-cases/poozabedu/get-report.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [PoozabeduApiController],
  providers: [
    SyncPoozabeduUseCase,
    GetStudentDetailUseCase,
    GetCollegeGpaUseCase,
    GetJournalUseCase,
    GetScheduleUseCase,
    ListEmployeesUseCase,
    GetReportUseCase,
    AuditService,
  ],
})
export class PoozabeduApiHttpModule {}
