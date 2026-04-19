import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumPlan } from '../../../domain/entities/curriculum-plan.entity';
import {
  CurriculumPlanFilter,
  CurriculumPlanRepository,
} from '../../../domain/repositories/curriculum-plan.repository';
import { CurriculumPlanOrmEntity } from '../entities/curriculum-plan.orm-entity';

@Injectable()
export class TypeOrmCurriculumPlanRepository implements CurriculumPlanRepository {
  constructor(
    @InjectRepository(CurriculumPlanOrmEntity)
    private readonly repo: Repository<CurriculumPlanOrmEntity>,
  ) {}

  async findById(id: string): Promise<CurriculumPlan | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(p: CurriculumPlan): Promise<CurriculumPlan> {
    const saved = await this.repo.save(this.toOrm(p));
    return this.toDomain(saved);
  }

  async update(p: CurriculumPlan): Promise<CurriculumPlan> {
    const saved = await this.repo.save(this.toOrm(p));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async list(filter: CurriculumPlanFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('p');
    if (filter.programCode) qb.andWhere('p.program_code = :pc', { pc: filter.programCode });
    if (filter.admissionYear) qb.andWhere('p.admission_year = :ay', { ay: filter.admissionYear });
    if (filter.status) qb.andWhere('p.status = :st', { st: filter.status });
    const [rows, total] = await qb
      .orderBy('p.admission_year', 'DESC')
      .addOrderBy('p.program_code', 'ASC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: CurriculumPlanOrmEntity): CurriculumPlan {
    return new CurriculumPlan(
      r.id, r.programCode, r.admissionYear, r.name, r.status, r.createdAt, r.updatedAt,
    );
  }

  private toOrm(p: CurriculumPlan): CurriculumPlanOrmEntity {
    const row = new CurriculumPlanOrmEntity();
    row.id = p.id;
    row.programCode = p.programCode;
    row.admissionYear = p.admissionYear;
    row.name = p.name;
    row.status = p.status;
    row.createdAt = p.createdAt;
    row.updatedAt = p.updatedAt;
    return row;
  }
}
