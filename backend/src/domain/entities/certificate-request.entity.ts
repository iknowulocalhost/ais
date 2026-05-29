export type CertificateType =
  | 'STUDY'
  | 'SCHOLARSHIP'
  | 'INCOME'
  | 'TAX'
  | 'MILITARY';

export type CertificateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export class CertificateRequest {
  constructor(
    public readonly id: string,
    /** Человекочитаемый номер справки («С-42»). Sequence из БД; null до INSERT. */
    public readonly displayNo: number | null,
    public certType: CertificateType,
    public fullName: string,
    public birthDate: Date,
    public groupName: string,
    public targetOrg: string,
    public phone: string,
    public email: string,
    public comment: string | null,
    public periodFrom: Date | null,
    public periodTo: Date | null,
    public status: CertificateStatus,
    public statusComment: string | null,
    public reviewerId: string | null,
    public maxUserId: string | null,
    public submitterUserId: string | null,
    /** ФИО в дательном падеже («Иванову Ивану Ивановичу»). */
    public fullNameDat: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  approve(reviewerId: string, comment?: string | null): void {
    this.status = 'APPROVED';
    this.statusComment = comment?.trim() || null;
    this.reviewerId = reviewerId;
    this.updatedAt = new Date();
  }

  reject(reviewerId: string, comment: string): void {
    if (!comment || !comment.trim()) {
      throw new Error('Причина отклонения обязательна');
    }
    this.status = 'REJECTED';
    this.statusComment = comment.trim();
    this.reviewerId = reviewerId;
    this.updatedAt = new Date();
  }

  resetToPending(reviewerId: string): void {
    this.status = 'PENDING';
    this.statusComment = null;
    this.reviewerId = reviewerId;
    this.updatedAt = new Date();
  }
}
