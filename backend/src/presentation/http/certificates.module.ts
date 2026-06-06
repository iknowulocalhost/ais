import { Module } from '@nestjs/common';
import { CertificatesController } from './controllers/certificates.controller';
import { SubmitCertificateUseCase } from '../../application/use-cases/certificates/submit-certificate.use-case';
import { ListCertificatesUseCase } from '../../application/use-cases/certificates/list-certificates.use-case';
import { SetCertificateStatusUseCase } from '../../application/use-cases/certificates/set-certificate-status.use-case';
import { UpdateCertificateDativeUseCase } from '../../application/use-cases/certificates/update-certificate-dative.use-case';
import { AuditService } from '../../application/services/audit.service';
import { DativeNameService } from '../../application/services/dative-name.service';

@Module({
  controllers: [CertificatesController],
  providers: [
    SubmitCertificateUseCase,
    ListCertificatesUseCase,
    SetCertificateStatusUseCase,
    UpdateCertificateDativeUseCase,
    AuditService,
    DativeNameService,
  ],
})
export class CertificatesModule {}
