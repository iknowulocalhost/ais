export type PassStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Hostel = 'NONE' | 'H1' | 'H2' | 'H3';

export class Pass {
  constructor(
    public readonly id: string,
    public fullName: string,
    public groupOrPosition: string,
    public hostel: Hostel,
    public ticketKey: string | null, // S3 object key (квитанция)
    public maxUserId: string | null,
    public status: PassStatus,
    public statusComment: string | null,
    public reviewerId: string | null,
    public submitterUserId: string | null,
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
      throw new Error('Причина отказа обязательна');
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
