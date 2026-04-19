import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { Payment } from '../../../domain/entities/payment.entity';
import {
  PaymentFilter,
  PaymentRepository,
} from '../../../domain/repositories/payment.repository';
import { PaymentOrmEntity } from '../entities/payment.orm-entity';

@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepository {
  constructor(
    @InjectRepository(PaymentOrmEntity) private readonly repo: Repository<PaymentOrmEntity>,
  ) {}

  async findById(id: string): Promise<Payment | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(p: Payment): Promise<Payment> {
    return this.toDomain(await this.repo.save(this.toOrm(p)));
  }

  async update(p: Payment): Promise<Payment> {
    return this.toDomain(await this.repo.save(this.toOrm(p)));
  }

  async list(filter: PaymentFilter, limit: number, offset: number) {
    const where: FindOptionsWhere<PaymentOrmEntity> = {};
    if (filter.studentId) where.studentId = filter.studentId;
    if (filter.status) where.status = filter.status;
    if (filter.from && filter.to) where.createdAt = Between(filter.from, filter.to);

    const [rows, total] = await this.repo.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async sumPaidByStudent(studentId: string): Promise<bigint> {
    const { sum } = await this.repo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount_kopecks), 0)', 'sum')
      .where('p.student_id = :sid', { sid: studentId })
      .andWhere("p.status = 'PAID'")
      .getRawOne<{ sum: string }>() ?? { sum: '0' };
    return BigInt(sum);
  }

  private toDomain(r: PaymentOrmEntity): Payment {
    return new Payment(
      r.id, r.studentId, r.purpose, r.amountKopecks, r.currency, r.status,
      r.dueDate, r.paidAt, r.externalRef, r.comment, r.createdAt, r.updatedAt,
    );
  }

  private toOrm(p: Payment): PaymentOrmEntity {
    const row = new PaymentOrmEntity();
    Object.assign(row, p);
    return row;
  }
}
