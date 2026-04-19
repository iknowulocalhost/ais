import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumEntry } from '../../../domain/entities/curriculum-entry.entity';
import { CurriculumEntryRepository } from '../../../domain/repositories/curriculum-entry.repository';
import { CurriculumEntryOrmEntity } from '../entities/curriculum-entry.orm-entity';

@Injectable()
export class TypeOrmCurriculumEntryRepository implements CurriculumEntryRepository {
  constructor(
    @InjectRepository(CurriculumEntryOrmEntity)
    private readonly repo: Repository<CurriculumEntryOrmEntity>,
  ) {}

  async findById(id: string): Promise<CurriculumEntry | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByPlanId(planId: string): Promise<CurriculumEntry[]> {
    const rows = await this.repo.find({
      where: { planId },
      order: { semester: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(e: CurriculumEntry): Promise<CurriculumEntry> {
    const saved = await this.repo.save(this.toOrm(e));
    return this.toDomain(saved);
  }

  async update(e: CurriculumEntry): Promise<CurriculumEntry> {
    const saved = await this.repo.save(this.toOrm(e));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  private toDomain(r: CurriculumEntryOrmEntity): CurriculumEntry {
    return new CurriculumEntry(
      r.id, r.planId, r.disciplineId, r.semester, r.controlForm, r.hours, r.createdAt,
    );
  }

  private toOrm(e: CurriculumEntry): CurriculumEntryOrmEntity {
    const row = new CurriculumEntryOrmEntity();
    row.id = e.id;
    row.planId = e.planId;
    row.disciplineId = e.disciplineId;
    row.semester = e.semester;
    row.controlForm = e.controlForm;
    row.hours = e.hours;
    row.createdAt = e.createdAt;
    return row;
  }
}
