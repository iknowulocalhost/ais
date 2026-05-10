import { Inject, Injectable } from '@nestjs/common';
import {
  CERTIFICATE_REQUEST_REPOSITORY,
  CertificateRequestFilter,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import { CertificateRequest } from '../../../domain/entities/certificate-request.entity';

@Injectable()
export class ListCertificatesUseCase {
  constructor(
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly certs: CertificateRequestRepository,
  ) {}

  async execute(
    filter: CertificateRequestFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: CertificateRequest[]; total: number }> {
    return this.certs.list(filter, Math.min(limit || 50, 200), Math.max(offset || 0, 0));
  }
}
