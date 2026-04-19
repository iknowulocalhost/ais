import { Module } from '@nestjs/common';
import { DocumentsController } from './controllers/documents.controller';
import { InitDocumentUploadUseCase } from '../../application/use-cases/documents/init-document-upload.use-case';
import { CompleteDocumentUploadUseCase } from '../../application/use-cases/documents/complete-document-upload.use-case';
import { VerifyDocumentUseCase } from '../../application/use-cases/documents/verify-document.use-case';
import { AuditService } from '../../application/services/audit.service';

@Module({
  controllers: [DocumentsController],
  providers: [
    InitDocumentUploadUseCase,
    CompleteDocumentUploadUseCase,
    VerifyDocumentUseCase,
    AuditService,
  ],
})
export class DocumentsModule {}
