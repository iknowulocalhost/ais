import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import * as ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import {
  REPORT_EXPORT_REPOSITORY,
  ReportExportRepository,
} from '../../../domain/repositories/report-export.repository';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';
import { ReportExportJobData, QUEUES } from '../queue.constants';

const PAGE = 500;

/**
 * Потоковая генерация XLSX: читаем БД постранично, пишем в exceljs streaming writer,
 * буфер → MinIO. Память ≈ константа, независимо от объёма данных.
 */
@Processor(QUEUES.REPORT_EXPORT)
export class ReportExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportExportProcessor.name);

  constructor(
    @Inject(REPORT_EXPORT_REPOSITORY) private readonly reports: ReportExportRepository,
    @Inject(STUDENT_REPOSITORY)       private readonly students: StudentRepository,
    @Inject(OBJECT_STORAGE)           private readonly storage: ObjectStorage,
  ) {
    super();
  }

  async process(job: Job<ReportExportJobData>): Promise<void> {
    const report = await this.reports.findById(job.data.exportId);
    if (!report) throw new Error(`Report ${job.data.exportId} not found`);

    this.logger.log(`[job ${job.id}] Start ${report.kind} for ${report.requestedBy}`);
    report.markRunning();
    await this.reports.update(report);

    try {
      const chunks: Buffer[] = [];
      const stream = new Readable({ read() {} });
      stream.on('data', (c: Buffer) => chunks.push(c));

      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });
      if (report.kind === 'STUDENTS_ROSTER') {
        await this.buildStudentsRoster(wb);
      }
      await wb.commit();
      stream.push(null);
      const buffer = Buffer.concat(chunks);

      const key = `reports/${report.id}.xlsx`;
      await this.storage.putObject({
        bucket: BUCKETS.DOCUMENTS,
        key,
        body: buffer,
        size: buffer.length,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      report.markReady(key);
      await this.reports.update(report);
      this.logger.log(`[job ${job.id}] Done → ${BUCKETS.DOCUMENTS}/${key} (${buffer.length} bytes)`);
    } catch (err) {
      report.markFailed((err as Error).message);
      await this.reports.update(report);
      throw err;
    }
  }

  private async buildStudentsRoster(wb: ExcelJS.stream.xlsx.WorkbookWriter): Promise<void> {
    const ws = wb.addWorksheet('Students');
    ws.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Фамилия', key: 'lastName', width: 20 },
      { header: 'Имя', key: 'firstName', width: 20 },
      { header: 'Отчество', key: 'middleName', width: 20 },
      { header: 'Статус', key: 'status', width: 16 },
      { header: 'Группа ID', key: 'groupId', width: 38 },
      { header: 'Дата рожд.', key: 'birthDate', width: 14 },
    ];
    let offset = 0;
    for (;;) {
      const { items } = await this.students.list({}, PAGE, offset);
      if (items.length === 0) break;
      for (const s of items) {
        ws.addRow({
          id: s.id, lastName: s.lastName, firstName: s.firstName, middleName: s.middleName,
          status: s.status, groupId: s.groupId, birthDate: s.birthDate,
        }).commit();
      }
      if (items.length < PAGE) break;
      offset += PAGE;
    }
    ws.commit();
  }

}
