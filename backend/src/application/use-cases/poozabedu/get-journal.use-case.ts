import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import {
  PzaGradebookEntry,
  PzaGradebookGroup,
  PzaGradebookSubject,
} from '../../../infrastructure/external/poozabeduapi/poozabeduapi.types';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import {
  POOZABEDU_STUDENT_GROUP_REPOSITORY,
  PoozabeduStudentGroupRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';

/**
 * On-demand-проксирование журнала из Сетевого ПОО.
 * Никаких сохранений в нашу БД: все вызовы — live, ничего не кэшируется.
 * Каждый запрос про оценки/пропуски пишется в audit_log с `READ_SENSITIVE`,
 * чтобы понять «кто, когда и по какой группе/предмету заглядывал».
 */
@Injectable()
export class GetJournalUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
    @Inject(POOZABEDU_STUDENT_GROUP_REPOSITORY)
    private readonly groupRepo: PoozabeduStudentGroupRepository,
  ) {}

  /** Список групп, доступных в журнале. Не аудитируем — это справочник. */
  listGroups(): Promise<PzaGradebookGroup[]> {
    return this.api.withSession(() => this.api.listGradebookGroups());
  }

  /** Семестры группы с предметами. Это уже специфично для группы — аудит. */
  async listGroupEntries(groupExternalId: number): Promise<PzaGradebookEntry[]> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const result = await this.api.withSession(() => this.api.getGradebookGroupEntries(groupExternalId));

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduGradebookEntries',
      entityId: String(groupExternalId),
      meta: { groupExternalId },
    });
    return result;
  }

  /**
   * Журнал по предмету. Если передан `constraints.allowedCuratorEmployeeId`
   * (актор — TEA), дополнительно проверяем, что `gradebookId` принадлежит одной из
   * его групп. Это защита от перебора прямых URL мимо UI: id журнала ≠ id группы,
   * без проверки TEA технически мог бы получить любой gradebook через адресную строку.
   *
   * Стоимость проверки: 1 upstream-запрос на каждую группу TEA. На практике у одного
   * классрука 1-2 группы — задержка <1 секунды.
   */
  async getSubject(
    gradebookId: number,
    subjectId: number,
    constraints?: { allowedCuratorEmployeeId?: number },
  ): Promise<PzaGradebookSubject> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    if (constraints?.allowedCuratorEmployeeId !== undefined) {
      await this.assertGradebookAccessible(gradebookId, constraints.allowedCuratorEmployeeId);
    }

    const result = await this.api.withSession(() => this.api.getGradebookSubject(gradebookId, subjectId));

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduGradebookSubject',
      entityId: `${gradebookId}/${subjectId}`,
      meta: { gradebookId, subjectId },
    });
    return result;
  }

  private async assertGradebookAccessible(
    gradebookId: number,
    curatorEmployeeId: number,
  ): Promise<void> {
    const ownedGroupIds = await this.groupRepo.listOwnedExternalIdsByCurator(curatorEmployeeId);
    if (ownedGroupIds.length === 0) {
      throw new ForbiddenException('Нет закреплённых за вами групп');
    }
    const allowed = await this.api.withSession(async () => {
      const set = new Set<number>();
      for (const gid of ownedGroupIds) {
        const entries = await this.api.getGradebookGroupEntries(gid);
        for (const e of entries) set.add(e.id);
      }
      return set;
    });
    if (!allowed.has(gradebookId)) {
      throw new ForbiddenException('Журнал не относится к вашим группам');
    }
  }
}
