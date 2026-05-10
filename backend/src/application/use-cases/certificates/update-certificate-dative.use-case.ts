import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CERTIFICATE_REQUEST_REPOSITORY,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import { DativeNameService } from '../../services/dative-name.service';

export interface UpdateCertificateDativeInput {
  certificateId: string;
  /**
   * Желаемое значение. `null` — сбросить к авто-генерации (пересчитаем petrovich).
   * Непустая строка — установить ровно её (ручная коррекция оператора).
   */
  fullNameDat: string | null;
}

/**
 * Ручное редактирование ФИО в дательном падеже на карточке справки.
 * Доступно тем же ролям, что меняют статус (ADM/COM/SUPERADMIN) — печатные формы
 * административный артефакт.
 */
@Injectable()
export class UpdateCertificateDativeUseCase {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly certs: CertificateRequestRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
    private readonly dative: DativeNameService,
  ) {}

  async execute(input: UpdateCertificateDativeInput): Promise<{ fullNameDat: string }> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const cert = await this.certs.findById(input.certificateId);
    if (!cert) throw new NotFoundException('Заявка не найдена');

    const oldValue = cert.fullNameDat;
    const next = input.fullNameDat === null
      ? this.dative.toDative(cert.fullName)
      : input.fullNameDat.trim();
    if (!next) throw new BadRequestException('Пустое значение недопустимо');

    cert.fullNameDat = next;
    cert.updatedAt = new Date();
    await this.certs.update(cert);

    await this.audit.record({
      ctx,
      action: 'UPDATE',
      entity: 'CertificateRequest',
      entityId: cert.id,
      oldState: { fullNameDat: oldValue },
      newState: { fullNameDat: next },
    });

    return { fullNameDat: next };
  }
}
