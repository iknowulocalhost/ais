import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportExport } from '../../../domain/entities/report-export.entity';
import { ReportExportRepository } from '../../../domain/repositories/report-export.repository';
import { ReportExportOrmEntity } from '../entities/report-export.orm-entity';

@Injectable()
export class TypeOrmReportExportRepository implements ReportExportRepository {
  constructor(
    @InjectRepository(ReportExportOrmEntity)
    private readonly repo: Repository<ReportExportOrmEntity>,
  ) {}

  async findById(id: string): Promise<ReportExport | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(r: ReportExport): Promise<ReportExport> {
    return this.toDomain(await this.repo.save(this.toOrm(r)));
  }

  async update(r: ReportExport): Promise<ReportExport> {
    return this.toDomain(await this.repo.save(this.toOrm(r)));
  }

  async listByUser(userId: string, limit: number): Promise<ReportExport[]> {
    const rows = await this.repo.find({
      where: { requestedBy: userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(r: ReportExportOrmEntity): ReportExport {
    return new ReportExport(
      r.id, r.kind, r.requestedBy, r.params, r.status, r.objectKey,
      r.errorMessage, r.createdAt, r.updatedAt,
    );
  }

  private toOrm(r: ReportExport): ReportExportOrmEntity {
    const row = new ReportExportOrmEntity();
    Object.assign(row, r);
    return row;
  }
}
