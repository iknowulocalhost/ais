import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Application } from '../../../domain/entities/application.entity';
import {
  ApplicationFilter,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository';
import { ApplicationOrmEntity } from '../entities/application.orm-entity';

@Injectable()
export class TypeOrmApplicationRepository implements ApplicationRepository {
  constructor(
    @InjectRepository(ApplicationOrmEntity)
    private readonly repo: Repository<ApplicationOrmEntity>,
  ) {}

  async findById(id: string): Promise<Application | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findManyByIds(ids: string[]): Promise<Application[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({ where: { id: In(ids) } });
    return rows.map((r) => this.toDomain(r));
  }

  async create(a: Application): Promise<Application> {
    const saved = await this.repo.save(this.toOrm(a));
    return this.toDomain(saved);
  }

  async update(a: Application): Promise<Application> {
    const saved = await this.repo.save(this.toOrm(a));
    return this.toDomain(saved);
  }

  async list(filter: ApplicationFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('a');
    if (filter.status) qb.andWhere('a.status = :status', { status: filter.status });
    if (filter.programCode) qb.andWhere('a.program_code = :pc', { pc: filter.programCode });
    if (filter.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('a.first_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('a.last_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('a.email ILIKE :q', { q: `%${filter.search}%` });
        }),
      );
    }
    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: ApplicationOrmEntity): Application {
    return new Application(
      r.id,
      r.firstName,
      r.lastName,
      r.middleName,
      r.birthDate,
      r.email,
      r.phone,
      r.programCode,
      r.status,
      r.rejectionReason,
      r.reviewerId,
      r.studentId,
      r.createdAt,
      r.updatedAt,
    );
  }

  private toOrm(a: Application): ApplicationOrmEntity {
    const row = new ApplicationOrmEntity();
    row.id = a.id;
    row.firstName = a.firstName;
    row.lastName = a.lastName;
    row.middleName = a.middleName;
    row.birthDate = a.birthDate;
    row.email = a.email;
    row.phone = a.phone;
    row.programCode = a.programCode;
    row.status = a.status;
    row.rejectionReason = a.rejectionReason;
    row.reviewerId = a.reviewerId;
    row.studentId = a.studentId;
    row.createdAt = a.createdAt;
    row.updatedAt = a.updatedAt;
    return row;
  }
}
