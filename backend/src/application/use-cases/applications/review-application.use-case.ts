import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository';
import { AuditService } from '../../services/audit.service';
import { NotifyService } from '../../services/notify.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export type ReviewDecision = 'TAKE' | 'ACCEPT' | 'REJECT';

export interface ReviewApplicationInput {
  applicationId: string;
  decision: ReviewDecision;
  reason?: string | null; // обязателен для REJECT
}

@Injectable()
export class ReviewApplicationUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly apps: ApplicationRepository,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: ReviewApplicationInput): Promise<void> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const app = await this.apps.findById(input.applicationId);
    if (!app) throw new NotFoundException('Заявка не найдена');

    const oldState = { status: app.status, rejectionReason: app.rejectionReason };

    switch (input.decision) {
      case 'TAKE':
        app.takeForReview(ctx.actorId);
        break;
      case 'ACCEPT':
        app.accept(ctx.actorId);
        break;
      case 'REJECT':
        if (!input.reason) throw new BadRequestException('reason обязателен для REJECT');
        app.reject(ctx.actorId, input.reason);
        break;
    }
    await this.apps.update(app);

    await this.audit.record({
      ctx,
      action: 'UPDATE',
      entity: 'Application',
      entityId: app.id,
      oldState,
      newState: { status: app.status, rejectionReason: app.rejectionReason },
    });

    // Уведомление только при финальных решениях; TAKE — внутреннее состояние.
    if (input.decision === 'ACCEPT') {
      await this.notify.enqueue({
        to: app.email,
        subject: 'Ваша заявка одобрена — АИС: Студенты',
        text:
          `Здравствуйте, ${app.firstName}!\n\n` +
          `Ваша заявка на направление «${app.programCode}» одобрена приёмной комиссией. ` +
          `В ближайшее время вы получите уведомление о зачислении.\n\n— АИС:Студенты`,
      });
    } else if (input.decision === 'REJECT') {
      await this.notify.enqueue({
        to: app.email,
        subject: 'Решение по вашей заявке — АИС: Студенты',
        text:
          `Здравствуйте, ${app.firstName}!\n\n` +
          `К сожалению, ваша заявка отклонена.\n` +
          `Причина: ${app.rejectionReason}\n\n— АИС:Студенты`,
      });
    }
  }
}
