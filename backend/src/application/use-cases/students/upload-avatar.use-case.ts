import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';
import { AuditContext, AuditService } from '../../services/audit.service';
import { AvatarProcessingJobData, QUEUES } from '../../../infrastructure/queue/queue.constants';

export interface UploadAvatarInput {
  studentId: string;
  body: Buffer;
  contentType: string;
  size: number;
}

/**
 * Загружает оригинал аватара в MinIO и ставит задачу фоновой обработки.
 * HTTP-ответ возвращается сразу — ресайз идёт в воркере BullMQ.
 */
@Injectable()
export class UploadAvatarUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @InjectQueue(QUEUES.AVATAR_PROCESSING) private readonly queue: Queue<AvatarProcessingJobData>,
    private readonly audit: AuditService,
  ) {}

  async execute(input: UploadAvatarInput, ctx: AuditContext): Promise<{ objectKey: string; jobId: string }> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundException('Студент не найден');

    const ext = input.contentType.split('/')[1] ?? 'bin';
    const key = `${student.id}/${randomUUID()}.${ext}`;

    await this.storage.putObject({
      bucket: BUCKETS.AVATARS,
      key,
      body: input.body,
      size: input.size,
      contentType: input.contentType,
    });

    const oldState = { avatarObjectKey: student.avatarObjectKey };
    student.avatarObjectKey = key;
    student.updatedAt = new Date();
    await this.students.update(student);

    const job = await this.queue.add(
      'resize',
      { studentId: student.id, sourceBucket: BUCKETS.AVATARS, sourceKey: key },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 },
    );

    await this.audit.record({
      ctx,
      action: 'UPDATE',
      entity: 'Student',
      entityId: student.id,
      oldState,
      newState: { avatarObjectKey: key },
      meta: { jobId: job.id },
    });

    return { objectKey: key, jobId: String(job.id) };
  }
}
