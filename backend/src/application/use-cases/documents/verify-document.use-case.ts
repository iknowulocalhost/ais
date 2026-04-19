import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  STUDENT_DOCUMENT_REPOSITORY,
  StudentDocumentRepository,
} from '../../../domain/repositories/student-document.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export type VerifyOutcome = { approve: true } | { approve: false; reason: string };

@Injectable()
export class VerifyDocumentUseCase {
  constructor(
    @Inject(STUDENT_DOCUMENT_REPOSITORY) private readonly docs: StudentDocumentRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(documentId: string, outcome: VerifyOutcome): Promise<void> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Не определён пользователь-верификатор');

    const doc = await this.docs.findById(documentId);
    if (!doc) throw new NotFoundException();

    const oldState = { status: doc.status, rejectionReason: doc.rejectionReason };
    if (outcome.approve) doc.verify(ctx.actorId);
    else doc.reject(ctx.actorId, outcome.reason);
    await this.docs.update(doc);

    await this.audit.record({
      ctx,
      action: 'UPDATE',
      entity: 'StudentDocument',
      entityId: doc.id,
      oldState,
      newState: { status: doc.status, rejectionReason: doc.rejectionReason, verifiedBy: doc.verifiedBy },
    });
  }
}
