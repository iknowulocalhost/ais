import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PASS_REPOSITORY,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import {
  BUCKETS,
  OBJECT_STORAGE,
  ObjectStorage,
} from '../../../domain/services/object-storage';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_BYTES = 10 * 1024 * 1024;

export interface InitPassTicketUploadInput {
  passId: string;
  contentType: string;
  sizeBytes: number;
  originalName: string;
  /**
   * `true` — админский путь: разрешаем менять квитанцию вне зависимости от статуса.
   * `false` (по умолчанию) — публичный путь: только пока заявка в PENDING,
   * иначе по утёкшему UUID можно было бы перезаписать квитанцию у уже обработанной.
   */
  bypassStatusCheck?: boolean;
}

export interface InitPassTicketUploadResult {
  objectKey: string;
  uploadUrl: string;
  ttlSeconds: number;
}

/**
 * Привязка квитанции к пропуску. Клиент льёт файл напрямую в MinIO по presigned PUT URL,
 * сразу обновляем `ticketKey`. Если у заявки уже была квитанция — старый объект
 * удаляем, чтобы не плодить осиротевшие файлы.
 */
@Injectable()
export class InitPassTicketUploadUseCase {
  constructor(
    @Inject(PASS_REPOSITORY) private readonly passes: PassRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async execute(input: InitPassTicketUploadInput): Promise<InitPassTicketUploadResult> {
    if (!ALLOWED_MIME.has(input.contentType)) {
      throw new BadRequestException('Допустимые форматы: PDF, PNG, JPEG, WebP');
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) {
      throw new BadRequestException(`Размер файла должен быть в пределах 1..${MAX_BYTES} байт`);
    }

    const pass = await this.passes.findById(input.passId);
    if (!pass) throw new NotFoundException('Заявка не найдена');
    if (!input.bypassStatusCheck && pass.status !== 'PENDING') {
      throw new BadRequestException('Заявка уже обработана — изменение квитанции невозможно');
    }

    // Расширение нормализуем — отбрасываем всё кроме [a-z0-9], максимум 8 символов.
    const rawExt = input.originalName.split('.').pop()?.toLowerCase() ?? 'bin';
    const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const objectKey = `${pass.id}/${randomUUID()}.${ext}`;

    const ttlSeconds = 900;
    const uploadUrl = await this.storage.getPresignedPutUrl(
      BUCKETS.PASSES,
      objectKey,
      ttlSeconds,
    );

    // Удалим прежнюю квитанцию (если была) — fire-and-forget по ошибкам storage.
    const previousKey = pass.ticketKey;

    pass.ticketKey = objectKey;
    pass.updatedAt = new Date();
    await this.passes.update(pass);

    if (previousKey && previousKey !== objectKey) {
      await this.storage.deleteObject(BUCKETS.PASSES, previousKey).catch(() => {
        /* осиротевший объект не критичен — почистится отдельным джобом */
      });
    }

    return { objectKey, uploadUrl, ttlSeconds };
  }
}
