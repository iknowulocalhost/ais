import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MaxBotNotification,
  MaxBotNotifier,
} from '../../domain/services/max-bot-notifier';

/**
 * Webhook-уведомление в alertbot. Fire-and-forget: исключения только логируются.
 * Адрес — MAX_BOT_URL (по умолчанию http://alertbot:5000/api/notify_user).
 */
@Injectable()
export class MaxBotService implements MaxBotNotifier {
  private readonly logger = new Logger(MaxBotService.name);
  private readonly url: string;
  private readonly timeoutMs = 2000;

  constructor(cfg: ConfigService) {
    this.url = cfg.get<string>('MAX_BOT_URL', 'http://alertbot:5000/api/notify_user');
  }

  async notifyUser(payload: MaxBotNotification): Promise<void> {
    if (!payload.userId) return;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: payload.userId,
          new_status: payload.newStatus,
          comment: payload.comment ?? '',
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Max-bot вернул ${res.status} для user_id=${payload.userId}`);
      }
    } catch (err) {
      this.logger.warn(
        `Max-bot недоступен (${this.url}): ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(t);
    }
  }
}
