import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_CHANNEL } from '../../domain/services/notification-channel';
import { SmtpNotificationChannel } from './smtp-notification-channel';
import { NotificationProcessor } from '../queue/processors/notification.processor';
import { NotifyService } from '../../application/services/notify.service';
import { QUEUES } from '../queue/queue.constants';

/**
 * Канал уведомлений + очередь + продьюсер. Глобальный, чтобы NotifyService
 * можно было инжектить в любые use-cases без повторного импорта модуля.
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  providers: [
    SmtpNotificationChannel,
    { provide: NOTIFICATION_CHANNEL, useExisting: SmtpNotificationChannel },
    NotificationProcessor,
    NotifyService,
  ],
  exports: [NOTIFICATION_CHANNEL, NotifyService],
})
export class NotificationsModule {}
