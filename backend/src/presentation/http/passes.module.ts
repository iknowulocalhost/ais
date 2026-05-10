import { Module } from '@nestjs/common';
import { PassesController } from './controllers/passes.controller';
import { SubmitPassUseCase } from '../../application/use-cases/passes/submit-pass.use-case';
import { ListPassesUseCase } from '../../application/use-cases/passes/list-passes.use-case';
import { SetPassStatusUseCase } from '../../application/use-cases/passes/set-pass-status.use-case';
import { InitPassTicketUploadUseCase } from '../../application/use-cases/passes/init-pass-ticket-upload.use-case';
import { DeletePassTicketUseCase } from '../../application/use-cases/passes/delete-pass-ticket.use-case';
import { AuditService } from '../../application/services/audit.service';
import { MaxBotService } from '../../application/services/max-bot.service';
import { MAX_BOT_NOTIFIER } from '../../domain/services/max-bot-notifier';

@Module({
  controllers: [PassesController],
  providers: [
    SubmitPassUseCase,
    ListPassesUseCase,
    SetPassStatusUseCase,
    InitPassTicketUploadUseCase,
    DeletePassTicketUseCase,
    AuditService,
    MaxBotService,
    { provide: MAX_BOT_NOTIFIER, useExisting: MaxBotService },
  ],
})
export class PassesModule {}
