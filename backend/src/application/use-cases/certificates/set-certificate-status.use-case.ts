import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CERTIFICATE_REQUEST_REPOSITORY,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import { AuditService } from '../../services/audit.service';
import { NotifyService } from '../../services/notify.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export type CertDecision = 'APPROVE' | 'REJECT' | 'RESET';

const STATUS_RU: Record<string, string> = {
  PENDING: 'возвращена в работу',
  APPROVED: 'выдана',
  REJECTED: 'отклонена',
};

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
    private readonly notify: NotifyService,
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

    // Уведомление в MAX через outbox (CompositeNotificationChannel найдёт
    // user.maxChatId). Шлём только при реальной смене статуса.
    if (oldState.status !== cert.status && cert.submitterUserId) {
      const verb = STATUS_RU[cert.status] ?? cert.status;
      const lines = [
        `Справка № С-${cert.displayNo ?? '?'} ${verb}.`,
        `Тип: ${cert.certType}`,
      ];
      if (cert.statusComment) lines.push(`Комментарий: ${cert.statusComment}`);
      await this.notify.enqueue({
        userId: cert.submitterUserId,
        to: cert.email,
        subject: 'Статус заявки на справку изменён',
        text: lines.join('\n'),
      });
    }
  }
}
