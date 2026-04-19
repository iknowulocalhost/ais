import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeSheet } from '../../../domain/entities/grade-sheet.entity';
import {
  GradeSheetFilter,
  GradeSheetRepository,
} from '../../../domain/repositories/grade-sheet.repository';
import { GradeSheetOrmEntity } from '../entities/grade-sheet.orm-entity';

@Injectable()
export class TypeOrmGradeSheetRepository implements GradeSheetRepository {
  constructor(
    @InjectRepository(GradeSheetOrmEntity)
    private readonly repo: Repository<GradeSheetOrmEntity>,
  ) {}

  async findById(id: string): Promise<GradeSheet | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(s: GradeSheet): Promise<GradeSheet> {
    const saved = await this.repo.save(this.toOrm(s));
    return this.toDomain(saved);
  }

  async update(s: GradeSheet): Promise<GradeSheet> {
    const saved = await this.repo.save(this.toOrm(s));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async list(filter: GradeSheetFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('gs');
    if (filter.groupId) qb.andWhere('gs.group_id = :gid', { gid: filter.groupId });
    if (filter.teacherId) qb.andWhere('gs.teacher_id = :tid', { tid: filter.teacherId });
    if (filter.status) qb.andWhere('gs.status = :st', { st: filter.status });
    if (filter.curriculumEntryId) qb.andWhere('gs.curriculum_entry_id = :eid', { eid: filter.curriculumEntryId });
    const [rows, total] = await qb
      .orderBy('gs.date', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: GradeSheetOrmEntity): GradeSheet {
    return new GradeSheet(
      r.id, r.groupId, r.curriculumEntryId, r.teacherId, r.date, r.status, r.createdAt, r.updatedAt,
    );
  }

  private toOrm(s: GradeSheet): GradeSheetOrmEntity {
    const row = new GradeSheetOrmEntity();
    row.id = s.id;
    row.groupId = s.groupId;
    row.curriculumEntryId = s.curriculumEntryId;
    row.teacherId = s.teacherId;
    row.date = s.date;
    row.status = s.status;
    row.createdAt = s.createdAt;
    row.updatedAt = s.updatedAt;
    return row;
  }
}
