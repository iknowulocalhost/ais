import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import {
  STUDENT_DOCUMENT_REPOSITORY,
  StudentDocumentRepository,
} from '../../../domain/repositories/student-document.repository';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';
import {
  DocumentKind,
  StudentDocument,
} from '../../../domain/entities/student-document.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MiB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export interface InitDocumentUploadInput {
  studentId: string;
  kind: DocumentKind;
  originalName: string;
  contentType: string;
  sizeBytes: number;
}

export interface InitDocumentUploadResult {
  documentId: string;
  objectKey: string;
  uploadUrl: string;  // presigned PUT — клиент заливает напрямую в MinIO
  ttlSeconds: number;
}

/**
 * Инициация загрузки: регистрирует документ в БД (статус PENDING) и выдаёт
 * presigned PUT URL. Клиент загружает файл напрямую в MinIO — API не прокачивает
 * тело через себя (экономим RAM и CPU на крупных сканах).
 */
@Injectable()
export class InitDocumentUploadUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(STUDENT_DOCUMENT_REPOSITORY) private readonly docs: StudentDocumentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: InitDocumentUploadInput): Promise<InitDocumentUploadResult> {
    if (!ALLOWED_MIME.has(input.contentType)) {
      throw new BadRequestException('Допустимые форматы: PDF, PNG, JPEG, WebP');
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_DOC_BYTES) {
      throw new BadRequestException(`Размер файла должен быть в пределах 1..${MAX_DOC_BYTES} байт`);
    }

    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundException('Студент не найден');

    const ctx = this.reqCtx.get();
    const ext = input.originalName.split('.').pop()?.toLowerCase() ?? 'bin';
    const objectKey = `${student.id}/${input.kind.toLowerCase()}/${randomUUID()}.${ext}`;

    const now = new Date();
    const doc = new StudentDocument(
      randomUUID(),
      student.id,
      input.kind,
      objectKey,
      input.originalName,
      input.contentType,
      input.sizeBytes,
      'PENDING',
      ctx.actorId,
      null,
      null,
      now,
      now,
    );
    const saved = await this.docs.create(doc);
    const ttlSeconds = 900;
    const uploadUrl = await this.storage.getPresignedPutUrl(BUCKETS.DOCUMENTS, objectKey, ttlSeconds);

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'StudentDocument',
      entityId: saved.id,
      newState: {
        studentId: saved.studentId,
        kind: saved.kind,
        status: saved.status,
        originalName: saved.originalName,
        sizeBytes: saved.sizeBytes,
      },
    });

    return { documentId: saved.id, objectKey, uploadUrl, ttlSeconds };
  }
}
