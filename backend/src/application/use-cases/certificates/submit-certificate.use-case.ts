import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CERTIFICATE_REQUEST_REPOSITORY,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import {
  CertificateRequest,
  CertificateType,
} from '../../../domain/entities/certificate-request.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import { DativeNameService } from '../../services/dative-name.service';

export interface SubmitCertificateInput {
  certType: CertificateType;
  fullName: string;
  birthDate: string; // ISO
  groupName: string;
  targetOrg: string;
  phone: string;
  email: string;
  comment?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  maxUserId?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class SubmitCertificateUseCase {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly certs: CertificateRequestRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
    private readonly dative: DativeNameService,
  ) {}

  async execute(input: SubmitCertificateInput): Promise<CertificateRequest> {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Некорректный email');
    if (!input.fullName.trim()) throw new BadRequestException('ФИО обязательно');
    if (!input.groupName.trim()) throw new BadRequestException('Группа обязательна');
    if (!input.targetOrg.trim()) {
      throw new BadRequestException('Целевая организация обязательна');
    }
    if (!input.phone.trim()) throw new BadRequestException('Телефон обязателен');
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const fullName = input.fullName.trim();
    const now = new Date();
    const cert = new CertificateRequest(
      randomUUID(),
      null, // displayNo заполнит БД через sequence
      input.certType,
      fullName,
      new Date(input.birthDate),
      input.groupName.trim(),
      input.targetOrg.trim(),
      input.phone.trim(),
      email,
      input.comment?.trim() || null,
      input.periodFrom ? new Date(input.periodFrom) : null,
      input.periodTo ? new Date(input.periodTo) : null,
      'PENDING',
      null,
      null,
      input.maxUserId?.trim() || null,
      ctx.actorId,
      // ФИО в дательном падеже — авто-генерация. Оператор может скорректировать в карточке.
      this.dative.toDative(fullName),
      now,
      now,
    );
    const saved = await this.certs.create(cert);

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'CertificateRequest',
      entityId: saved.id,
      newState: { certType: saved.certType, email: saved.email, status: saved.status },
    });

    return saved;
  }
}
