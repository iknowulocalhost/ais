import { BadRequestException, Injectable } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import {
  PzaScheduleClassrooms,
  PzaScheduleGroupEntries,
  PzaScheduleTeachers,
  PzaScheduleTimetable,
} from '../../../infrastructure/external/poozabeduapi/poozabeduapi.types';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * On-demand-проксирование расписания из Сетевого ПОО.
 * Расписание не привязано к ПДн напрямую (не содержит паспортных данных),
 * но раскрывает структуру учебного процесса — поэтому ставим audit на конкретные
 * запросы с фильтром «по группе» / «по преподавателю».
 */
@Injectable()
export class GetScheduleUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  listTeachers(): Promise<PzaScheduleTeachers> {
    return this.api.withSession(() => this.api.listScheduleTeachers());
  }

  listClassrooms(): Promise<PzaScheduleClassrooms> {
    return this.api.withSession(() => this.api.listScheduleClassrooms());
  }

  /** Список планов расписания у группы (нужен, чтобы взять `id` плана для timetable). */
  async getGroupEntries(groupExternalId: number): Promise<PzaScheduleGroupEntries> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const result = await this.api.withSession(() => this.api.getScheduleGroupEntries(groupExternalId));

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduScheduleGroupEntries',
      entityId: String(groupExternalId),
      meta: { groupExternalId },
    });
    return result;
  }

  /**
   * Расписание за период. Если `type=studentGroup` и `id`=plan — это сетка уроков
   * группы за `[from, to]`.
   */
  async getTimetable(
    dateFrom: string,
    dateTo: string,
    type: 'studentGroup' | 'teacher',
    id: number,
  ): Promise<PzaScheduleTimetable> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const result = await this.api.withSession(() =>
      this.api.getScheduleTimetable(dateFrom, dateTo, type, id),
    );

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduScheduleTimetable',
      entityId: `${type}:${id}`,
      meta: { dateFrom, dateTo, type, id },
    });
    return result;
  }
}
