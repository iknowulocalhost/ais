import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Student } from '../../../domain/entities/student.entity';
import {
  StudentFilter,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import { StudentOrmEntity } from '../entities/student.orm-entity';

@Injectable()
export class TypeOrmStudentRepository implements StudentRepository {
  constructor(
    @InjectRepository(StudentOrmEntity) private readonly repo: Repository<StudentOrmEntity>,
  ) {}

  async findById(id: string): Promise<Student | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByUserId(userId: string): Promise<Student | null> {
    const r = await this.repo.findOne({ where: { userId } });
    return r ? this.toDomain(r) : null;
  }

  async create(s: Student): Promise<Student> {
    const saved = await this.repo.save(this.toOrm(s));
    return this.toDomain(saved);
  }

  async update(s: Student): Promise<Student> {
    const saved = await this.repo.save(this.toOrm(s));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async list(filter: StudentFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('s');
    if (filter.status) qb.andWhere('s.status = :status', { status: filter.status });
    if (filter.groupId) qb.andWhere('s.group_id = :gid', { gid: filter.groupId });
    if (filter.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('s.first_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('s.last_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('s.middle_name ILIKE :q', { q: `%${filter.search}%` });
        }),
      );
    }
    const [rows, total] = await qb
      .orderBy('s.last_name', 'ASC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: StudentOrmEntity): Student {
    return new Student(
      r.id,
      r.userId,
      r.groupId,
      r.firstName,
      r.lastName,
      r.middleName,
      r.birthDate,
      r.status,
      r.avatarObjectKey,
      r.createdAt,
      r.updatedAt,
    );
  }

  private toOrm(s: Student): StudentOrmEntity {
    const row = new StudentOrmEntity();
    row.id = s.id;
    row.userId = s.userId;
    row.groupId = s.groupId;
    row.firstName = s.firstName;
    row.lastName = s.lastName;
    row.middleName = s.middleName;
    row.birthDate = s.birthDate;
    row.status = s.status;
    row.avatarObjectKey = s.avatarObjectKey;
    row.createdAt = s.createdAt;
    row.updatedAt = s.updatedAt;
    return row;
  }
}
