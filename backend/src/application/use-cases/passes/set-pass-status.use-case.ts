import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PASS_REPOSITORY,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import {
  MAX_BOT_NOTIFIER,
  MaxBotNotifier,
} from '../../../domain/services/max-bot-notifier';

export type PassDecision = 'APPROVE' | 'REJECT' | 'RESET';

export interface SetPassStatusInput {
  passId: string;
  decision: PassDecision;
  comment?: string | null;
}

@Injectable()
export class SetPassStatusUseCase {
  constructor(
    @Inject(PASS_REPOSITORY) private readonly passes: PassRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
    @Inject(MAX_BOT_NOTIFIER) private readonly bot: MaxBotNotifier,
  ) {}

  async execute(input: SetPassStatusInput): Promise<void> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const pass = await this.passes.findById(input.passId);
    if (!pass) throw new NotFoundException('Заявка не найдена');

    const oldState = { status: pass.status, statusComment: pass.statusComment };

    switch (input.decision) {
      case 'APPROVE':
        pass.approve(ctx.actorId, input.comment ?? null);
        break;
      case 'REJECT':
        if (!input.comment) throw new BadRequestException('comment обязателен для REJECT');
        pass.reject(ctx.actorId, input.comment);
        break;
      case 'RESET':
        pass.resetToPending(ctx.actorId);
        break;
    }
    await this.passes.update(pass);

    await this.audit.record({
      ctx,
      action: 'UPDATE',
      entity: 'Pass',
      entityId: pass.id,
      oldState,
      newState: { status: pass.status, statusComment: pass.statusComment },
    });

    // Webhook в Max-бот: только если у заявки привязан max_user_id
    // и статус действительно изменился. Бот отправит студенту push сам.
    if (pass.maxUserId && oldState.status !== pass.status) {
      await this.bot.notifyUser({
        userId: pass.maxUserId,
        newStatus: pass.status,
        comment: pass.statusComment,
      });
    }
  }
}
