import { Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import {
  MAX_OUTBOX_REPOSITORY,
  MaxOutboxRepository,
} from '../../../domain/repositories/max-outbox.repository';
import { MAX_OUTBOX_PURGE_JOB_NAME, QUEUES } from '../queue.constants';

/** Ежедневная чистка доставленных max_outbox. MAX_OUTBOX_PURGE_CRON / DAYS. */
@Processor(QUEUES.MAX_OUTBOX_PURGE, { concurrency: 1 })
export class MaxOutboxPurgeProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaxOutboxPurgeProcessor.name);

  constructor(
    @InjectQueue(QUEUES.MAX_OUTBOX_PURGE) private readonly queue: Queue,
    @Inject(MAX_OUTBOX_REPOSITORY) private readonly outbox: MaxOutboxRepository,
    private readonly cfg: ConfigService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const cron = this.cfg.get<string>('MAX_OUTBOX_PURGE_CRON', '15 4 * * *'); // ежедневно 04:15
    const existing = await this.queue.getRepeatableJobs();
    for (const r of existing) {
      if (r.name === MAX_OUTBOX_PURGE_JOB_NAME && r.pattern !== cron) {
        await this.queue.removeRepeatableByKey(r.key);
        this.logger.log(`Удалено устаревшее расписание ${r.pattern}`);
      }
    }
    await this.queue.add(
      MAX_OUTBOX_PURGE_JOB_NAME,
      {},
      {
        repeat: { pattern: cron },
        jobId: MAX_OUTBOX_PURGE_JOB_NAME,
        removeOnComplete: { age: 7 * 24 * 3600, count: 30 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    );
    this.logger.log(`max_outbox purge cron запланирован: "${cron}"`);
  }

  async process(job: Job): Promise<void> {
    const days = Number(this.cfg.get<string>('MAX_OUTBOX_PURGE_DAYS', '14')) || 14;
    const n = await this.outbox.purgeOlderThan(days);
    this.logger.log(`[job ${job.id}] max_outbox: удалено ${n} (>${days} дней)`);
  }
}
