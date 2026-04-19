import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentDocument } from '../../../domain/entities/student-document.entity';
import { StudentDocumentRepository } from '../../../domain/repositories/student-document.repository';
import { StudentDocumentOrmEntity } from '../entities/student-document.orm-entity';

@Injectable()
export class TypeOrmStudentDocumentRepository implements StudentDocumentRepository {
  constructor(
    @InjectRepository(StudentDocumentOrmEntity)
    private readonly repo: Repository<StudentDocumentOrmEntity>,
  ) {}

  async findById(id: string): Promise<StudentDocument | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async listByStudent(studentId: string): Promise<StudentDocument[]> {
    const rows = await this.repo.find({ where: { studentId }, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toDomain(r));
  }

  async create(d: StudentDocument): Promise<StudentDocument> {
    return this.toDomain(await this.repo.save(this.toOrm(d)));
  }

  async update(d: StudentDocument): Promise<StudentDocument> {
    return this.toDomain(await this.repo.save(this.toOrm(d)));
  }

  async delete(id: string): Promise<void> { await this.repo.delete({ id }); }

  private toDomain(r: StudentDocumentOrmEntity): StudentDocument {
    return new StudentDocument(
      r.id, r.studentId, r.kind, r.objectKey, r.originalName, r.contentType,
      Number(r.sizeBytes), r.status, r.uploadedBy, r.verifiedBy, r.rejectionReason,
      r.createdAt, r.updatedAt,
    );
  }

  private toOrm(d: StudentDocument): StudentDocumentOrmEntity {
    const row = new StudentDocumentOrmEntity();
    Object.assign(row, d);
    return row;
  }
}
