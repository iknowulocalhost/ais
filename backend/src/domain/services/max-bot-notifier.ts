/**
 * Порт для уведомлений в Max-бот (alertbot).
 * Используется при смене статуса пропуска: бот шлёт студенту push.
 *
 * Реализация — application/services/max-bot.service.ts.
 * Сбой отправки не должен ломать основной флоу.
 */
export interface MaxBotNotification {
  userId: string;        // max_user_id, который пришёл при создании пропуска
  newStatus: string;     // PENDING/APPROVED/REJECTED — оставляем как есть, бот сам разрулит локализацию
  comment?: string | null;
}

export abstract class MaxBotNotifier {
  abstract notifyUser(payload: MaxBotNotification): Promise<void>;
}

export const MAX_BOT_NOTIFIER = Symbol('MAX_BOT_NOTIFIER');
