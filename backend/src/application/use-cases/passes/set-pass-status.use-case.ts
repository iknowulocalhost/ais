import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PASS_REPOSITORY,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import { AuditService } from '../../services/audit.service';
import { NotifyService } from '../../services/notify.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export type PassDecision = 'APPROVE' | 'REJECT' | 'RESET';

const PASS_STATUS_RU: Record<string, string> = {
  PENDING: 'возвращена в работу',
  APPROVED: 'одобрена — пропуск готов к выдаче',
  REJECTED: 'отклонена',
};

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
    private readonly notify: NotifyService,
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

    // MAX → outbox через NotifyService.
    if (oldState.status !== pass.status && pass.submitterUserId) {
      const verb = PASS_STATUS_RU[pass.status] ?? pass.status;
      const lines = [`Заявка на пропуск ${verb}.`];
      if (pass.statusComment) lines.push(`Комментарий: ${pass.statusComment}`);
      await this.notify.enqueue({
        userId: pass.submitterUserId,
        to: '',
        subject: 'Статус заявки на пропуск изменён',
        text: lines.join('\n'),
      });
    }
  }
}
