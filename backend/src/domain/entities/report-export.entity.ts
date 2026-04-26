export type ReportKind = 'STUDENTS_ROSTER';
export type ReportStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';

export class ReportExport {
  constructor(
    public readonly id: string,
    public kind: ReportKind,
    public requestedBy: string,
    public params: Record<string, unknown>,
    public status: ReportStatus,
    public objectKey: string | null,   // готовый XLSX в MinIO
    public errorMessage: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  markRunning(): void { this.status = 'RUNNING'; this.updatedAt = new Date(); }
  markReady(key: string): void { this.status = 'READY'; this.objectKey = key; this.updatedAt = new Date(); }
  markFailed(msg: string): void { this.status = 'FAILED'; this.errorMessage = msg; this.updatedAt = new Date(); }
}
