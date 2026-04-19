import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Discipline } from '../../../domain/entities/discipline.entity';
import {
  DisciplineFilter,
  DisciplineRepository,
} from '../../../domain/repositories/discipline.repository';
import { DisciplineOrmEntity } from '../entities/discipline.orm-entity';

@Injectable()
export class TypeOrmDisciplineRepository implements DisciplineRepository {
  constructor(
    @InjectRepository(DisciplineOrmEntity) private readonly repo: Repository<DisciplineOrmEntity>,
  ) {}

  async findById(id: string): Promise<Discipline | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByCode(code: string): Promise<Discipline | null> {
    const r = await this.repo.findOne({ where: { code } });
    return r ? this.toDomain(r) : null;
  }

  async create(d: Discipline): Promise<Discipline> {
    const saved = await this.repo.save(this.toOrm(d));
    return this.toDomain(saved);
  }

  async update(d: Discipline): Promise<Discipline> {
    const saved = await this.repo.save(this.toOrm(d));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async list(filter: DisciplineFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('d');
    if (filter.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('d.name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('d.code ILIKE :q', { q: `%${filter.search}%` });
        }),
      );
    }
    const [rows, total] = await qb
      .orderBy('d.name', 'ASC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: DisciplineOrmEntity): Discipline {
    return new Discipline(r.id, r.code, r.name, r.totalHours, r.createdAt, r.updatedAt);
  }

  private toOrm(d: Discipline): DisciplineOrmEntity {
    const row = new DisciplineOrmEntity();
    row.id = d.id;
    row.code = d.code;
    row.name = d.name;
    row.totalHours = d.totalHours;
    row.createdAt = d.createdAt;
    row.updatedAt = d.updatedAt;
    return row;
  }
}
