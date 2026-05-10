import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CERTIFICATE_REQUEST_REPOSITORY,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import {
  MAX_BOT_NOTIFIER,
  MaxBotNotifier,
} from '../../../domain/services/max-bot-notifier';

export type CertDecision = 'APPROVE' | 'REJECT' | 'RESET';

export interface SetCertificateStatusInput {
  certificateId: string;
  decision: CertDecision;
  comment?: string | null;
}

@Injectable()
export class SetCertificateStatusUseCase {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly certs: CertificateRequestRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
    @Inject(MAX_BOT_NOTIFIER) private readonly bot: MaxBotNotifier,
  ) {}

  async execute(input: SetCertificateStatusInput): Promise<void> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const cert = await this.certs.findById(input.certificateId);
    if (!cert) throw new NotFoundException('Заявка не найдена');

    const oldState = { status: cert.status, statusComment: cert.statusComment };

    switch (input.decision) {
      case 'APPROVE':
        cert.approve(ctx.actorId, input.comment ?? null);
        break;
      case 'REJECT':
        if (!input.comment) throw new BadRequestException('comment обязателен для REJECT');
        cert.reject(ctx.actorId, input.comment);
        break;
      case 'RESET':
        cert.resetToPending(ctx.actorId);
        break;
    }
    await this.certs.update(cert);

    await this.audit.record({
      ctx,
      action: 'UPDATE',
      entity: 'CertificateRequest',
      entityId: cert.id,
      oldState,
      newState: { status: cert.status, statusComment: cert.statusComment },
    });

    // Push в Max-бот, если у заявки есть max_user_id (актуально для заявок,
    // созданных через бота). Email-уведомления намеренно не шлём: канал общения
    // со студентом — Max-бот; email в карточке остаётся как контактная информация.
    if (oldState.status !== cert.status && cert.maxUserId) {
      await this.bot.notifyUser({
        userId: cert.maxUserId,
        newStatus: cert.status,
        comment: cert.statusComment,
      });
    }
  }
}
