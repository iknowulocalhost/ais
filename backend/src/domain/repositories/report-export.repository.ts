import { ReportExport } from '../entities/report-export.entity';

export abstract class ReportExportRepository {
  abstract findById(id: string): Promise<ReportExport | null>;
  abstract create(r: ReportExport): Promise<ReportExport>;
  abstract update(r: ReportExport): Promise<ReportExport>;
  abstract listByUser(userId: string, limit: number): Promise<ReportExport[]>;
}

export const REPORT_EXPORT_REPOSITORY = Symbol('REPORT_EXPORT_REPOSITORY');
