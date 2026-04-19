import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { TypeOrmUserRepository } from './repositories/user.repository.impl';
import { TypeOrmAuditLogRepository } from './repositories/audit-log.repository.impl';
import { TypeOrmGroupRepository } from './repositories/group.repository.impl';
import { TypeOrmStudentRepository } from './repositories/student.repository.impl';
import { TypeOrmStudentDocumentRepository } from './repositories/student-document.repository.impl';
import { TypeOrmPaymentRepository } from './repositories/payment.repository.impl';
import { TypeOrmReportExportRepository } from './repositories/report-export.repository.impl';
import { TypeOrmApplicationRepository } from './repositories/application.repository.impl';
import { TypeOrmDisciplineRepository } from './repositories/discipline.repository.impl';
import { TypeOrmCurriculumPlanRepository } from './repositories/curriculum-plan.repository.impl';
import { TypeOrmCurriculumEntryRepository } from './repositories/curriculum-entry.repository.impl';
import { TypeOrmGradeSheetRepository } from './repositories/grade-sheet.repository.impl';
import { TypeOrmGradeRepository } from './repositories/grade.repository.impl';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { AUDIT_LOG_REPOSITORY } from '../../domain/repositories/audit-log.repository';
import { GROUP_REPOSITORY } from '../../domain/repositories/group.repository';
import { STUDENT_REPOSITORY } from '../../domain/repositories/student.repository';
import { STUDENT_DOCUMENT_REPOSITORY } from '../../domain/repositories/student-document.repository';
import { PAYMENT_REPOSITORY } from '../../domain/repositories/payment.repository';
import { REPORT_EXPORT_REPOSITORY } from '../../domain/repositories/report-export.repository';
import { APPLICATION_REPOSITORY } from '../../domain/repositories/application.repository';
import { DISCIPLINE_REPOSITORY } from '../../domain/repositories/discipline.repository';
import { CURRICULUM_PLAN_REPOSITORY } from '../../domain/repositories/curriculum-plan.repository';
import { CURRICULUM_ENTRY_REPOSITORY } from '../../domain/repositories/curriculum-entry.repository';
import { GRADE_SHEET_REPOSITORY } from '../../domain/repositories/grade-sheet.repository';
import { GRADE_REPOSITORY } from '../../domain/repositories/grade.repository';

const ORM_ENTITIES = [
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
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get<string>('DB_USER', 'ais'),
        password: cfg.get<string>('DB_PASSWORD', 'ais_secret'),
        database: cfg.get<string>('DB_NAME', 'ais_students'),
        entities: ORM_ENTITIES,
        synchronize: false,
        migrationsRun: false,
        logging: cfg.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
    TypeOrmModule.forFeature(ORM_ENTITIES),
  ],
  providers: [
    TypeOrmUserRepository,
    TypeOrmAuditLogRepository,
    TypeOrmGroupRepository,
    TypeOrmStudentRepository,
    TypeOrmStudentDocumentRepository,
    TypeOrmPaymentRepository,
    TypeOrmReportExportRepository,
    TypeOrmApplicationRepository,
    TypeOrmDisciplineRepository,
    TypeOrmCurriculumPlanRepository,
    TypeOrmCurriculumEntryRepository,
    TypeOrmGradeSheetRepository,
    TypeOrmGradeRepository,
    { provide: USER_REPOSITORY,             useExisting: TypeOrmUserRepository },
    { provide: AUDIT_LOG_REPOSITORY,        useExisting: TypeOrmAuditLogRepository },
    { provide: GROUP_REPOSITORY,            useExisting: TypeOrmGroupRepository },
    { provide: STUDENT_REPOSITORY,          useExisting: TypeOrmStudentRepository },
    { provide: STUDENT_DOCUMENT_REPOSITORY, useExisting: TypeOrmStudentDocumentRepository },
    { provide: PAYMENT_REPOSITORY,          useExisting: TypeOrmPaymentRepository },
    { provide: REPORT_EXPORT_REPOSITORY,    useExisting: TypeOrmReportExportRepository },
    { provide: APPLICATION_REPOSITORY,      useExisting: TypeOrmApplicationRepository },
    { provide: DISCIPLINE_REPOSITORY,      useExisting: TypeOrmDisciplineRepository },
    { provide: CURRICULUM_PLAN_REPOSITORY, useExisting: TypeOrmCurriculumPlanRepository },
    { provide: CURRICULUM_ENTRY_REPOSITORY,useExisting: TypeOrmCurriculumEntryRepository },
    { provide: GRADE_SHEET_REPOSITORY,     useExisting: TypeOrmGradeSheetRepository },
    { provide: GRADE_REPOSITORY,           useExisting: TypeOrmGradeRepository },
  ],
  exports: [
    USER_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    GROUP_REPOSITORY,
    STUDENT_REPOSITORY,
    STUDENT_DOCUMENT_REPOSITORY,
    PAYMENT_REPOSITORY,
    REPORT_EXPORT_REPOSITORY,
    APPLICATION_REPOSITORY,
    DISCIPLINE_REPOSITORY,
    CURRICULUM_PLAN_REPOSITORY,
    CURRICULUM_ENTRY_REPOSITORY,
    GRADE_SHEET_REPOSITORY,
    GRADE_REPOSITORY,
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
