export type DocumentKind =
  | 'PASSPORT'       // паспорт
  | 'SNILS'
  | 'EDU_CERTIFICATE' // аттестат/диплом
  | 'MEDICAL'        // мед. справка
  | 'PHOTO'          // фото 3x4
  | 'OTHER';

export type DocumentStatus = 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';

export class StudentDocument {
  constructor(
    public readonly id: string,
    public studentId: string,
    public kind: DocumentKind,
    public objectKey: string,          // ключ в бакете documents
    public originalName: string,
    public contentType: string,
    public sizeBytes: number,
    public status: DocumentStatus,
    public uploadedBy: string | null,  // userId
    public verifiedBy: string | null,
    public rejectionReason: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  markUploaded(): void {
    this.status = 'UPLOADED';
    this.updatedAt = new Date();
  }

  verify(by: string): void {
    this.status = 'VERIFIED';
    this.verifiedBy = by;
    this.rejectionReason = null;
    this.updatedAt = new Date();
  }

  reject(by: string, reason: string): void {
    this.status = 'REJECTED';
    this.verifiedBy = by;
    this.rejectionReason = reason;
    this.updatedAt = new Date();
  }
}
