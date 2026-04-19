import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserOrmEntity } from './entities/user.orm-entity';
import { AuditLogOrmEntity } from './entities/audit-log.orm-entity';
import { GroupOrmEntity } from './entities/group.orm-entity';
import { StudentOrmEntity } from './entities/student.orm-entity';
import { StudentDocumentOrmEntity } from './entities/student-document.orm-entity';
import { PaymentOrmEntity } from './entities/payment.orm-entity';
import { ReportExportOrmEntity } from './entities/report-export.orm-entity';
import { ApplicationOrmEntity } from './entities/application.orm-entity';
import { DisciplineOrmEntity } from './entities/discipline.orm-entity';
import { CurriculumPlanOrmEntity } from './entities/curriculum-plan.orm-entity';
import { CurriculumEntryOrmEntity } from './entities/curriculum-entry.orm-entity';
import { GradeSheetOrmEntity } from './entities/grade-sheet.orm-entity';
import { GradeOrmEntity } from './entities/grade.orm-entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'ais',
  password: process.env.DB_PASSWORD ?? 'ais_secret',
  database: process.env.DB_NAME ?? 'ais_students',
  entities: [
    UserOrmEntity,
    AuditLogOrmEntity,
    GroupOrmEntity,
    StudentOrmEntity,
    StudentDocumentOrmEntity,
    PaymentOrmEntity,
    ReportExportOrmEntity,
    ApplicationOrmEntity,
    DisciplineOrmEntity,
    CurriculumPlanOrmEntity,
    CurriculumEntryOrmEntity,
    GradeSheetOrmEntity,
    GradeOrmEntity,
  ],
  migrations: ['src/infrastructure/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
