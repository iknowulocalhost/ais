import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from '../../../domain/entities/grade.entity';
import { GradeRepository } from '../../../domain/repositories/grade.repository';
import { GradeOrmEntity } from '../entities/grade.orm-entity';

@Injectable()
export class TypeOrmGradeRepository implements GradeRepository {
  constructor(
    @InjectRepository(GradeOrmEntity) private readonly repo: Repository<GradeOrmEntity>,
  ) {}

  async findById(id: string): Promise<Grade | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findBySheetId(sheetId: string): Promise<Grade[]> {
    const rows = await this.repo.find({ where: { sheetId }, order: { createdAt: 'ASC' } });
    return rows.map((r) => this.toDomain(r));
  }

  async findByStudentId(studentId: string): Promise<Grade[]> {
    const rows = await this.repo.find({ where: { studentId }, order: { createdAt: 'ASC' } });
    return rows.map((r) => this.toDomain(r));
  }

  async create(g: Grade): Promise<Grade> {
    const saved = await this.repo.save(this.toOrm(g));
    return this.toDomain(saved);
  }

  async createMany(grades: Grade[]): Promise<Grade[]> {
    const saved = await this.repo.save(grades.map((g) => this.toOrm(g)));
    return saved.map((r) => this.toDomain(r));
  }

  async update(g: Grade): Promise<Grade> {
    const saved = await this.repo.save(this.toOrm(g));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  private toDomain(r: GradeOrmEntity): Grade {
    return new Grade(r.id, r.sheetId, r.studentId, r.value, r.comment, r.createdAt, r.updatedAt);
  }

  private toOrm(g: Grade): GradeOrmEntity {
    const row = new GradeOrmEntity();
    row.id = g.id;
    row.sheetId = g.sheetId;
    row.studentId = g.studentId;
    row.value = g.value;
    row.comment = g.comment;
    row.createdAt = g.createdAt;
    row.updatedAt = g.updatedAt;
    return row;
  }
}
