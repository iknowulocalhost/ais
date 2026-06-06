import { Module } from '@nestjs/common';
import { PassesController } from './controllers/passes.controller';
import { SubmitPassUseCase } from '../../application/use-cases/passes/submit-pass.use-case';
import { ListPassesUseCase } from '../../application/use-cases/passes/list-passes.use-case';
import { SetPassStatusUseCase } from '../../application/use-cases/passes/set-pass-status.use-case';
import { InitPassTicketUploadUseCase } from '../../application/use-cases/passes/init-pass-ticket-upload.use-case';
import { DeletePassTicketUseCase } from '../../application/use-cases/passes/delete-pass-ticket.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [PassesController],
  providers: [
    SubmitPassUseCase,
    ListPassesUseCase,
    SetPassStatusUseCase,
    InitPassTicketUploadUseCase,
    DeletePassTicketUseCase,
    AuditService,
  ],
})
export class PassesModule {}
