import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  NOTIFICATION_CHANNEL,
  NotificationChannel,
} from '../../../domain/services/notification-channel';
import { NotificationJobData, QUEUES } from '../queue.constants';

/**
 * Фоновая отправка уведомлений. Любое доменное событие, которое должно вылиться
 * в email, просто ставит job в эту очередь — HTTP-поток не ждёт SMTP.
 *
 * Ретраи настраиваются на уровне продюсера (см. notify.service.ts).
 */
@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const ok = await this.channel.send({
      to: job.data.to,
      subject: job.data.subject,
      text: job.data.text,
      html: job.data.html,
    });
    if (!ok) {
      // Пробрасываем — BullMQ засчитает failure и ретрайнет согласно политике.
      throw new Error(`NotificationChannel.send returned false for ${job.data.to}`);
    }
    this.logger.debug(`[job ${job.id}] sent → ${job.data.to}`);
  }
}
