/**
 * Порт канала уведомлений. Реализации (console, SMTP, push) живут в infrastructure.
 * Domain-слой не знает про nodemailer / SMTP.
 */
export interface NotificationMessage {
  to: string;         // email-адрес
  subject: string;
  text: string;       // plain-text body (обязательный, для клиентов без HTML)
  html?: string;      // опциональная HTML-версия
}

export abstract class NotificationChannel {
  /** @returns true если отправка успешна; false — если канал недоступен, но ошибку не пробрасываем */
  abstract send(msg: NotificationMessage): Promise<boolean>;
}

export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');
