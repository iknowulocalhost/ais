import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { NotificationJobData, QUEUES } from '../../infrastructure/queue/queue.constants';

/**
 * Тонкая обёртка над BullMQ-очередью `notifications`.
 * Use-cases вызывают `notify.enqueue(...)` — отправка идёт в воркере.
 *
 * Падение enqueue ЛОГИРУЕТСЯ, но НЕ пробрасывается: уведомление — побочный
 * эффект, он не должен ломать основной бизнес-флоу (аналогично AuditService).
 */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue<NotificationJobData>,
  ) {}

  async enqueue(data: NotificationJobData): Promise<void> {
    try {
      await this.queue.add('send', data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      });
    } catch (err) {
      this.logger.warn(
        `Не удалось поставить уведомление для ${data.to}: ${(err as Error).message}`,
      );
    }
  }
}
