import { Injectable, NotFoundException } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import { PzaStudentDetail } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.types';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * On-demand: получить полную карточку студента из Сетевого ПОО.
 * Намеренно НЕ кешируем и НЕ сохраняем в БД — данные содержат паспортные ПДн.
 * Каждый вызов уходит в upstream, аудит фиксирует кто и когда смотрел.
 */
@Injectable()
export class GetStudentDetailUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(externalId: number): Promise<PzaStudentDetail> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new NotFoundException('Неаутентифицирован');

    const result = await this.api.withSession(() => this.api.getStudentDetail(externalId));

    // Сетевой ПОО на несуществующий id возвращает 200 с пустым объектом —
    // явно валидируем по обязательным полям и кидаем 404.
    if (!result || typeof result !== 'object' || !result.id || !result.lastName) {
      throw new NotFoundException(`Студент с id=${externalId} не найден`);
    }

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduStudentDetail',
      entityId: String(externalId),
      meta: {
        // Только сам факт обращения и идентификатор. ПДн в audit_log не пишем.
        externalId,
      },
    });
    return result;
  }
}
