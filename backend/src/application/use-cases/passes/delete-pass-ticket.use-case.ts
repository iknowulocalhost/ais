import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PASS_REPOSITORY,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import {
  BUCKETS,
  OBJECT_STORAGE,
  ObjectStorage,
} from '../../../domain/services/object-storage';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * Удаление квитанции у заявки на пропуск.
 * Чистим объект в MinIO и сбрасываем `ticketKey`. Действие админское —
 * чтобы не оставлять у студента возможность затереть свою квитанцию по утёкшему UUID.
 */
@Injectable()
export class DeletePassTicketUseCase {
  constructor(
    @Inject(PASS_REPOSITORY) private readonly passes: PassRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(passId: string): Promise<void> {
    const pass = await this.passes.findById(passId);
    if (!pass) throw new NotFoundException('Заявка не найдена');
    if (!pass.ticketKey) return; // нечего удалять — идемпотентно

    const oldKey = pass.ticketKey;
    pass.ticketKey = null;
    pass.updatedAt = new Date();
    await this.passes.update(pass);

    // Чистим объект после коммита БД — если упадём здесь, осиротевший файл
    // некритичен (ссылки на него уже нет в БД).
    await this.storage.deleteObject(BUCKETS.PASSES, oldKey).catch(() => {
      /* проглочено — отдельный джоб подберёт */
    });

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'UPDATE',
      entity: 'Pass',
      entityId: pass.id,
      oldState: { ticketKey: oldKey },
      newState: { ticketKey: null },
    });
  }
}
