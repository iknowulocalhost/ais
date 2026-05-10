import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { SyncPoozabeduUseCase } from '../../../application/use-cases/poozabedu/sync-poozabedu.use-case';
import { POOZABEDU_SYNC_JOB_NAME, QUEUES } from '../queue.constants';

/**
 * Фоновая ежедневная синхронизация справочников из Сетевого ПОО.
 *
 * Реализован через BullMQ repeatable job:
 *  - При старте процесса бэка регистрируем повторяющуюся задачу с cron-расписанием.
 *  - BullMQ кладёт по этому расписанию в очередь job, мы его подхватываем здесь.
 *  - Расписание дублируется при каждом старте, но Bull сам по `JobId`/`pattern` ловит
 *    дубли — так что повторное `add` безопасно.
 *
 * Время по умолчанию: 03:00 в часовом поясе сервера.
 * Конфигурация:
 *   POOZABEDU_SYNC_CRON     cron-выражение, по умолчанию '0 3 * * *'
 *   POOZABEDU_SYNC_ENABLED  'true'/'false', по умолчанию true (отключаем для тестов)
 */
@Processor(QUEUES.POOZABEDU_SYNC, { concurrency: 1 })
export class PoozabeduSyncProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(PoozabeduSyncProcessor.name);

  constructor(
    @InjectQueue(QUEUES.POOZABEDU_SYNC) private readonly queue: Queue,
    private readonly syncUc: SyncPoozabeduUseCase,
    private readonly cfg: ConfigService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.cfg.get<string>('POOZABEDU_SYNC_ENABLED', 'true') !== 'true') {
      this.logger.log('poozabedu sync cron отключён (POOZABEDU_SYNC_ENABLED=false)');
      return;
    }
    const cron = this.cfg.get<string>('POOZABEDU_SYNC_CRON', '0 3 * * *');

    // Сначала уберём старые версии расписания (если cron в env поменяли).
    const existing = await this.queue.getRepeatableJobs();
    for (const r of existing) {
      if (r.name === POOZABEDU_SYNC_JOB_NAME && r.pattern !== cron) {
        await this.queue.removeRepeatableByKey(r.key);
        this.logger.log(`Удалено устаревшее расписание ${r.pattern}`);
      }
    }

    await this.queue.add(
      POOZABEDU_SYNC_JOB_NAME,
      {},
      {
        repeat: { pattern: cron },
        // Уникальный jobId предотвращает накопление дубликатов в Redis при рестартах.
        jobId: POOZABEDU_SYNC_JOB_NAME,
        removeOnComplete: { age: 7 * 24 * 3600, count: 50 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    );
    this.logger.log(`poozabedu sync cron запланирован: "${cron}"`);
  }

  async process(job: Job): Promise<void> {
    const t0 = Date.now();
    this.logger.log(`[job ${job.id}] poozabedu sync — старт`);
    try {
      const report = await this.syncUc.execute();
      this.logger.log(
        `[job ${job.id}] готово за ${Date.now() - t0}мс: ` +
          `dept=${report.departments.total}/-${report.departments.deactivated}, ` +
          `group=${report.groups.total}/-${report.groups.deactivated}, ` +
          `student=${report.students.total}/-${report.students.deactivated}`,
      );
    } catch (err) {
      // Не бросаем — bullmq сам ретраит при ошибке. Логируем подробно для разбора.
      this.logger.error(
        `[job ${job.id}] poozabedu sync упал: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
