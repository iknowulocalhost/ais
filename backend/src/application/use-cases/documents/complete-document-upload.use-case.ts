import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  STUDENT_DOCUMENT_REPOSITORY,
  StudentDocumentRepository,
} from '../../../domain/repositories/student-document.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * Клиент сообщает, что закончил загрузку в MinIO. Меняем статус PENDING → UPLOADED.
 * Доверять клиенту нельзя — в будущем добавим проверку HEAD в MinIO перед сменой статуса.
 */
@Injectable()
export class CompleteDocumentUploadUseCase {
  constructor(
    @Inject(STUDENT_DOCUMENT_REPOSITORY) private readonly docs: StudentDocumentRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(documentId: string): Promise<void> {
    const doc = await this.docs.findById(documentId);
    if (!doc) throw new NotFoundException();

    const oldState = { status: doc.status };
    doc.markUploaded();
    await this.docs.update(doc);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'UPDATE',
      entity: 'StudentDocument',
      entityId: doc.id,
      oldState,
      newState: { status: doc.status },
    });
  }
}
