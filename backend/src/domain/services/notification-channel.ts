export interface NotificationMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  userId?: string;
}

export abstract class NotificationChannel {
  abstract send(msg: NotificationMessage): Promise<boolean>;
}

export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');
