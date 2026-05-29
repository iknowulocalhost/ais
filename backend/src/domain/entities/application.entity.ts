export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ENROLLED';

export class Application {
  constructor(
    public readonly id: string,
    public firstName: string,
    public lastName: string,
    public middleName: string | null,
    public birthDate: Date,
    public email: string,
    public phone: string | null,
    public programCode: string, // код направления/специальности
    public status: ApplicationStatus,
    public rejectionReason: string | null,
    public reviewerId: string | null, // COM, кто последний рулил
    public studentId: string | null,  // проставляется при ENROLLED
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  takeForReview(reviewerId: string): void {
    if (this.status !== 'SUBMITTED' && this.status !== 'UNDER_REVIEW') {
      throw new Error(`Нельзя взять в работу: текущий статус ${this.status}`);
    }
    this.status = 'UNDER_REVIEW';
    this.reviewerId = reviewerId;
    this.updatedAt = new Date();
  }

  accept(reviewerId: string): void {
    if (this.status !== 'UNDER_REVIEW' && this.status !== 'SUBMITTED') {
      throw new Error(`Нельзя принять: текущий статус ${this.status}`);
    }
    this.status = 'ACCEPTED';
    this.rejectionReason = null;
    this.reviewerId = reviewerId;
    this.updatedAt = new Date();
  }

  reject(reviewerId: string, reason: string): void {
    if (this.status === 'ENROLLED') {
      throw new Error('Нельзя отклонить уже зачисленного');
    }
    if (!reason || !reason.trim()) {
      throw new Error('Причина отказа обязательна');
    }
    this.status = 'REJECTED';
    this.rejectionReason = reason.trim();
    this.reviewerId = reviewerId;
    this.updatedAt = new Date();
  }

  markEnrolled(studentId: string): void {
    if (this.status !== 'ACCEPTED') {
      throw new Error(`Зачислить можно только из ACCEPTED, текущий ${this.status}`);
    }
    this.status = 'ENROLLED';
    this.studentId = studentId;
    this.updatedAt = new Date();
  }
}
