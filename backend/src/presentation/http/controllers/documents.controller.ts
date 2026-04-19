import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { InitDocumentUploadUseCase } from '../../../application/use-cases/documents/init-document-upload.use-case';
import { CompleteDocumentUploadUseCase } from '../../../application/use-cases/documents/complete-document-upload.use-case';
import { VerifyDocumentUseCase } from '../../../application/use-cases/documents/verify-document.use-case';
import { InitDocumentUploadDto, VerifyDocumentDto } from '../dto/document.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import {
  STUDENT_DOCUMENT_REPOSITORY,
  StudentDocumentRepository,
} from '../../../domain/repositories/student-document.repository';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';

@Controller()
export class DocumentsController {
  constructor(
    private readonly initUC: InitDocumentUploadUseCase,
    private readonly completeUC: CompleteDocumentUploadUseCase,
    private readonly verifyUC: VerifyDocumentUseCase,
    @Inject(STUDENT_DOCUMENT_REPOSITORY) private readonly docs: StudentDocumentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Roles(Role.ADM, Role.COM, Role.STU)
  @Post('students/:studentId/documents')
  init(@Param('studentId', new ParseUUIDPipe()) studentId: string, @Body() dto: InitDocumentUploadDto) {
    return this.initUC.execute({ studentId, ...dto });
  }

  @Roles(Role.ADM, Role.COM, Role.STU)
  @Post('documents/:id/complete')
  complete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.completeUC.execute(id);
  }

  @Roles(Role.ADM, Role.COM)
  @Post('documents/:id/verify')
  verify(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: VerifyDocumentDto) {
    if (dto.outcome === 'REJECT' && !dto.reason) {
      throw new BadRequestException('При отклонении нужна причина (reason)');
    }
    return this.verifyUC.execute(
      id,
      dto.outcome === 'APPROVE' ? { approve: true } : { approve: false, reason: dto.reason! },
    );
  }

  @Roles(Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get('students/:studentId/documents')
  list(@Param('studentId', new ParseUUIDPipe()) studentId: string) {
    return this.docs.listByStudent(studentId);
  }

  @Roles(Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get('documents/:id/download-url')
  async downloadUrl(@Param('id', new ParseUUIDPipe()) id: string) {
    const d = await this.docs.findById(id);
    if (!d) throw new NotFoundException();
    const url = await this.storage.getPresignedGetUrl(BUCKETS.DOCUMENTS, d.objectKey, 900);
    return { url, ttlSeconds: 900 };
  }
}
