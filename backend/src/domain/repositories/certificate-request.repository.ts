import {
  CertificateRequest,
  CertificateStatus,
  CertificateType,
} from '../entities/certificate-request.entity';

export interface CertificateRequestFilter {
  status?: CertificateStatus;
  certType?: CertificateType;
  search?: string; // ФИО / группа / email
  submitterUserId?: string;
  /** ISO yyyy-mm-dd. Включительно по нижней границе. */
  createdFrom?: string;
  /** ISO yyyy-mm-dd. Включительно по верхней границе. */
  createdTo?: string;
}

export abstract class CertificateRequestRepository {
  abstract findById(id: string): Promise<CertificateRequest | null>;
  abstract create(c: CertificateRequest): Promise<CertificateRequest>;
  abstract update(c: CertificateRequest): Promise<CertificateRequest>;
  abstract list(
    filter: CertificateRequestFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: CertificateRequest[]; total: number }>;
}

export const CERTIFICATE_REQUEST_REPOSITORY = Symbol(
  'CERTIFICATE_REQUEST_REPOSITORY',
);
