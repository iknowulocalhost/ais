import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  REPORT_EXPORT_REPOSITORY,
  ReportExportRepository,
} from '../../../domain/repositories/report-export.repository';
import { ReportExport, ReportKind } from '../../../domain/entities/report-export.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import { QUEUES, ReportExportJobData } from '../../../infrastructure/queue/queue.constants';

@Injectable()
export class RequestExportUseCase {
  constructor(
    @Inject(REPORT_EXPORT_REPOSITORY) private readonly reports: ReportExportRepository,
    @InjectQueue(QUEUES.REPORT_EXPORT) private readonly queue: Queue<ReportExportJobData>,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(kind: ReportKind, params: Record<string, unknown> = {}): Promise<ReportExport> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException();

    const now = new Date();
    const report = new ReportExport(
      randomUUID(), kind, ctx.actorId, params, 'QUEUED', null, null, now, now,
    );
    const saved = await this.reports.create(report);

    await this.queue.add(
      'export',
      { exportId: saved.id },
      { attempts: 2, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 50, removeOnFail: 20 },
    );

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'ReportExport',
      entityId: saved.id,
      newState: { kind: saved.kind, params: saved.params },
    });
    return saved;
  }
}
