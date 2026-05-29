import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** HTTP-клиент MAX-бота: POST /api/ais/notify, header X-AIS-Token. */
@Injectable()
export class MaxNotificationChannel {
  private readonly logger = new Logger(MaxNotificationChannel.name);
  private readonly url: string;
  private readonly secret: string;

  constructor(private readonly cfg: ConfigService) {
    this.url = cfg.get<string>('MAX_BOT_URL', '').replace(/\/+$/, '');
    this.secret = cfg.get<string>('MAX_BOT_AIS_SHARED_SECRET', '');
  }

  isEnabled(): boolean {
    return !!this.url && !!this.secret;
  }

  async sendToChat(maxChatId: string, text: string): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.warn('MAX-канал отключён (нет MAX_BOT_URL/MAX_BOT_AIS_SHARED_SECRET)');
      return false;
    }
    try {
      const res = await fetch(`${this.url}/api/ais/notify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ais-token': this.secret,
        },
        body: JSON.stringify({ max_chat_id: maxChatId, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`MAX-бот вернул ${res.status}: ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`MAX-канал недоступен: ${(err as Error).message}`);
      return false;
    }
  }
}
