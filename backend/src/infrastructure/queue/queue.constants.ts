export const QUEUES = {
  AVATAR_PROCESSING: 'avatar-processing',
  REPORT_EXPORT: 'report-export',
  NOTIFICATIONS: 'notifications',
  POOZABEDU_SYNC: 'poozabeduapi-sync',
} as const;

/** Имя repeatable-задачи. Bull использует его для идемпотентности расписания. */
export const POOZABEDU_SYNC_JOB_NAME = 'poozabeduapi-sync-daily';

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
}
