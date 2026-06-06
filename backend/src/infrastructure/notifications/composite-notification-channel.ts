import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationMessage,
} from '../../domain/services/notification-channel';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import {
  MAX_OUTBOX_REPOSITORY,
  MaxOutboxRepository,
} from '../../domain/repositories/max-outbox.repository';

/** Канал уведомлений → outbox для MAX. Без max_chat_id — пропуск с WARN. */
@Injectable()
export class CompositeNotificationChannel extends NotificationChannel {
  private readonly logger = new Logger(CompositeNotificationChannel.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(MAX_OUTBOX_REPOSITORY) private readonly outbox: MaxOutboxRepository,
  ) {
    super();
  }

  async send(msg: NotificationMessage): Promise<boolean> {
    if (!msg.userId) {
      this.logger.warn(`notification skipped: userId не задан (subject=${msg.subject})`);
      return false;
    }
    const user = await this.users.findById(msg.userId);
    if (!user) {
      this.logger.warn(`notification skipped: пользователь ${msg.userId} не найден`);
      return false;
    }
    if (!user.maxChatId) {
      this.logger.warn(`notification skipped: у ${user.email} не привязан MAX`);
      return false;
    }
    const text = msg.subject ? `**${msg.subject}**\n\n${msg.text}` : msg.text;
    const id = await this.outbox.enqueue({
      userId: user.id,
      maxChatId: user.maxChatId,
      text,
    });
    this.logger.log(`max_outbox #${id} → chat ${user.maxChatId} (${user.email})`);
    return true;
  }
}
