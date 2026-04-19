export const QUEUES = {
  AVATAR_PROCESSING: 'avatar-processing',
  REPORT_EXPORT: 'report-export',
  NOTIFICATIONS: 'notifications',
} as const;

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
