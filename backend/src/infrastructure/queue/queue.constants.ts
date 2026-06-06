export const QUEUES = {
  AVATAR_PROCESSING: 'avatar-processing',
  REPORT_EXPORT: 'report-export',
  NOTIFICATIONS: 'notifications',
  POOZABEDU_SYNC: 'poozabeduapi-sync',
  MAX_OUTBOX_PURGE: 'max-outbox-purge',
} as const;

/** Имя repeatable-задачи. Bull использует его для идемпотентности расписания. */
export const POOZABEDU_SYNC_JOB_NAME = 'poozabeduapi-sync-daily';
export const MAX_OUTBOX_PURGE_JOB_NAME = 'max-outbox-purge-daily';

export interface AvatarProcessingJobData {
  studentId: string;
  sourceBucket: string;
  sourceKey: string;
}

export interface ReportExportJobData {
  exportId: string;
}

export interface NotificationJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** UUID юзера АИС: канал ищет user.maxChatId и шлёт в outbox. */
  userId?: string;
}
