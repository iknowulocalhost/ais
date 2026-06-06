import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_CHANNEL } from '../../domain/services/notification-channel';
import { SmtpNotificationChannel } from './smtp-notification-channel';
import { MaxNotificationChannel } from './max-notification-channel';
import { CompositeNotificationChannel } from './composite-notification-channel';
import { NotificationProcessor } from '../queue/processors/notification.processor';
import { NotifyService } from '../../application/services/notify.service';
import { QUEUES } from '../queue/queue.constants';

/** Канал уведомлений (Composite → MAX) + очередь BullMQ. Активный = MAX. */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  providers: [
    SmtpNotificationChannel,
    MaxNotificationChannel,
    CompositeNotificationChannel,
    { provide: NOTIFICATION_CHANNEL, useExisting: CompositeNotificationChannel },
    NotificationProcessor,
    NotifyService,
  ],
  exports: [NOTIFICATION_CHANNEL, NotifyService, MaxNotificationChannel],
})
export class NotificationsModule {}
