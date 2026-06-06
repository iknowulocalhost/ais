import { BadRequestException, Injectable } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/** Прокси к /services/reports/*. SSRF-валидация пути + READ_SENSITIVE в аудит. */
@Injectable()
export class GetReportUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(
    relativePath: string,
    query: Record<string, string | number | undefined>,
  ): Promise<unknown> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    if (!/^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-./]*$/u.test(relativePath)) {
      throw new BadRequestException('Недопустимый путь отчёта');
    }
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      throw new BadRequestException('Недопустимый путь отчёта');
    }

    const result = await this.api.withSession(() => this.api.getReport(relativePath, query));

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduReport',
      entityId: relativePath,
      meta: { relativePath, query },
    });
    return result;
  }
}
