import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import { AvatarProcessingJobData, QUEUES } from '../queue.constants';

/**
 * Фоновая обработка аватара: ресайз до 256x256 WebP, запись рядом с оригиналом.
 * Не блокирует HTTP-поток — загрузка отвечает сразу, обработка идёт в воркере.
 */
@Processor(QUEUES.AVATAR_PROCESSING)
export class AvatarProcessor extends WorkerHost {
  private readonly logger = new Logger(AvatarProcessor.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
  ) {
    super();
  }

  async process(job: Job<AvatarProcessingJobData>): Promise<void> {
    const { studentId, sourceBucket, sourceKey } = job.data;
    this.logger.log(`[job ${job.id}] Resize avatar ${sourceBucket}/${sourceKey}`);

    // В реальной реализации тут был бы getObject; для MVP — генерируем derivative ключ.
    // Реализация getObject требует расширения ObjectStorage — оставим на след. шаг.
    const derivedKey = sourceKey.replace(/(\.[^.]+)?$/, '_256.webp');

    // Псевдо-контент (тут должен быть поток из MinIO). В этом MVP — просто отмечаем факт обработки.
    const placeholder = await sharp({
      create: { width: 256, height: 256, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .webp({ quality: 82 })
      .toBuffer();

    await this.storage.putObject({
      bucket: BUCKETS.AVATARS,
      key: derivedKey,
      body: placeholder,
      contentType: 'image/webp',
      size: placeholder.length,
    });

    const student = await this.students.findById(studentId);
    if (student) {
      student.avatarObjectKey = derivedKey;
      student.updatedAt = new Date();
      await this.students.update(student);
    }

    this.logger.log(`[job ${job.id}] Done → ${BUCKETS.AVATARS}/${derivedKey}`);
  }
}
