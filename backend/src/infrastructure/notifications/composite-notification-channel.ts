import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationMessage,
} from '../../domain/services/notification-channel';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import { MaxNotificationChannel } from './max-notification-channel';

/** Канал уведомлений → MAX. Без max_chat_id у пользователя — пропуск с WARN. */
@Injectable()
export class CompositeNotificationChannel extends NotificationChannel {
  private readonly logger = new Logger(CompositeNotificationChannel.name);

  constructor(
    private readonly max: MaxNotificationChannel,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super();
  }

  async send(msg: NotificationMessage): Promise<boolean> {
    if (!msg.userId) {
      this.logger.warn(
        `notification skipped: userId не задан (to=${msg.to}, subject=${msg.subject})`,
      );
      return false;
    }
    const user = await this.users.findById(msg.userId);
    if (!user) {
      this.logger.warn(`notification skipped: пользователь ${msg.userId} не найден`);
      return false;
    }
    if (!user.maxChatId) {
      this.logger.warn(
        `notification skipped: у ${user.email} не привязан MAX (subject=${msg.subject})`,
      );
      return false;
    }
    const text = msg.subject
      ? `**${msg.subject}**\n\n${msg.text}`
      : msg.text;
    return this.max.sendToChat(user.maxChatId, text);
  }
}
