export type PaymentPurpose = 'TUITION' | 'DORM' | 'FINE' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

/**
 * Платёж. Деньги — BIGINT копеек (int8), никогда NUMERIC/FLOAT.
 * Правило ACC: статус меняется только через доменные методы.
 */
export class Payment {
  constructor(
    public readonly id: string,
    public studentId: string,
    public purpose: PaymentPurpose,
    public amountKopecks: bigint,     // сумма в копейках (RUB)
    public currency: string,          // 'RUB'
    public status: PaymentStatus,
    public dueDate: Date,
    public paidAt: Date | null,
    public externalRef: string | null, // id из платёжного шлюза
    public comment: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  markPaid(externalRef: string | null, at = new Date()): void {
    if (this.status === 'PAID') return;
    if (this.status === 'CANCELLED' || this.status === 'REFUNDED') {
      throw new Error(`Нельзя оплатить платёж в статусе ${this.status}`);
    }
    this.status = 'PAID';
    this.paidAt = at;
    this.externalRef = externalRef;
    this.updatedAt = new Date();
  }

  cancel(reason: string): void {
    if (this.status === 'PAID' || this.status === 'REFUNDED') {
      throw new Error(`Нельзя отменить платёж в статусе ${this.status}`);
    }
    this.status = 'CANCELLED';
    this.comment = reason;
    this.updatedAt = new Date();
  }

  refund(): void {
    if (this.status !== 'PAID') throw new Error('Возврат возможен только для оплаченных');
    this.status = 'REFUNDED';
    this.updatedAt = new Date();
  }
}
