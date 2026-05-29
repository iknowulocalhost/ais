import { Global, Module } from '@nestjs/common';
import * as path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from './entities/user.orm-entity';
import { AuditLogOrmEntity } from './entities/audit-log.orm-entity';
import { GroupOrmEntity } from './entities/group.orm-entity';
import { StudentOrmEntity } from './entities/student.orm-entity';
import { StudentDocumentOrmEntity } from './entities/student-document.orm-entity';
import { ReportExportOrmEntity } from './entities/report-export.orm-entity';
import { ApplicationOrmEntity } from './entities/application.orm-entity';
import { DisciplineOrmEntity } from './entities/discipline.orm-entity';
import { CurriculumPlanOrmEntity } from './entities/curriculum-plan.orm-entity';
import { CurriculumEntryOrmEntity } from './entities/curriculum-entry.orm-entity';
import { GradeSheetOrmEntity } from './entities/grade-sheet.orm-entity';
import { GradeOrmEntity } from './entities/grade.orm-entity';
import { ApplicantOrmEntity } from './entities/applicant.orm-entity';
import { PassOrmEntity } from './entities/pass.orm-entity';
import { CertificateRequestOrmEntity } from './entities/certificate-request.orm-entity';
import { CommentOptionOrmEntity } from './entities/comment-option.orm-entity';
import {
  PoozabeduDepartmentOrmEntity,
  PoozabeduStudentGroupOrmEntity,
  PoozabeduStudentOrmEntity,
} from './entities/poozabedu-mirror.orm-entity';
import { MaxLinkTokenOrmEntity } from './entities/max-link-token.orm-entity';
import { TypeOrmUserRepository } from './repositories/user.repository.impl';
import { TypeOrmAuditLogRepository } from './repositories/audit-log.repository.impl';
import { TypeOrmGroupRepository } from './repositories/group.repository.impl';
import { TypeOrmStudentRepository } from './repositories/student.repository.impl';
import { TypeOrmStudentDocumentRepository } from './repositories/student-document.repository.impl';
import { TypeOrmReportExportRepository } from './repositories/report-export.repository.impl';
import { TypeOrmApplicationRepository } from './repositories/application.repository.impl';
import { TypeOrmDisciplineRepository } from './repositories/discipline.repository.impl';
import { TypeOrmCurriculumPlanRepository } from './repositories/curriculum-plan.repository.impl';
import { TypeOrmCurriculumEntryRepository } from './repositories/curriculum-entry.repository.impl';
import { TypeOrmGradeSheetRepository } from './repositories/grade-sheet.repository.impl';
import { TypeOrmGradeRepository } from './repositories/grade.repository.impl';
import { TypeOrmApplicantRepository } from './repositories/applicant.repository.impl';
import { TypeOrmPassRepository } from './repositories/pass.repository.impl';
import { TypeOrmCertificateRequestRepository } from './repositories/certificate-request.repository.impl';
import { TypeOrmCommentOptionRepository } from './repositories/comment-option.repository.impl';
import {
  TypeOrmPoozabeduDepartmentRepository,
  TypeOrmPoozabeduStudentGroupRepository,
  TypeOrmPoozabeduStudentRepository,
} from './repositories/poozabedu-mirror.repository.impl';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { AUDIT_LOG_REPOSITORY } from '../../domain/repositories/audit-log.repository';
import { GROUP_REPOSITORY } from '../../domain/repositories/group.repository';
import { STUDENT_REPOSITORY } from '../../domain/repositories/student.repository';
import { STUDENT_DOCUMENT_REPOSITORY } from '../../domain/repositories/student-document.repository';
import { REPORT_EXPORT_REPOSITORY } from '../../domain/repositories/report-export.repository';
import { APPLICATION_REPOSITORY } from '../../domain/repositories/application.repository';
import { DISCIPLINE_REPOSITORY } from '../../domain/repositories/discipline.repository';
import { CURRICULUM_PLAN_REPOSITORY } from '../../domain/repositories/curriculum-plan.repository';
import { CURRICULUM_ENTRY_REPOSITORY } from '../../domain/repositories/curriculum-entry.repository';
import { GRADE_SHEET_REPOSITORY } from '../../domain/repositories/grade-sheet.repository';
import { GRADE_REPOSITORY } from '../../domain/repositories/grade.repository';
import { APPLICANT_REPOSITORY } from '../../domain/repositories/applicant.repository';
import { PASS_REPOSITORY } from '../../domain/repositories/pass.repository';
import { CERTIFICATE_REQUEST_REPOSITORY } from '../../domain/repositories/certificate-request.repository';
import { COMMENT_OPTION_REPOSITORY } from '../../domain/repositories/comment-option.repository';
import {
  POOZABEDU_DEPARTMENT_REPOSITORY,
  POOZABEDU_STUDENT_GROUP_REPOSITORY,
  POOZABEDU_STUDENT_REPOSITORY,
} from '../../domain/repositories/poozabedu-mirror.repository';

const ORM_ENTITIES = [
  UserOrmEntity,
  AuditLogOrmEntity,
  GroupOrmEntity,
  StudentOrmEntity,
  StudentDocumentOrmEntity,
  ReportExportOrmEntity,
  ApplicationOrmEntity,
  DisciplineOrmEntity,
  CurriculumPlanOrmEntity,
  CurriculumEntryOrmEntity,
  GradeSheetOrmEntity,
  GradeOrmEntity,
  ApplicantOrmEntity,
  PassOrmEntity,
  CertificateRequestOrmEntity,
  CommentOptionOrmEntity,
  PoozabeduDepartmentOrmEntity,
  PoozabeduStudentGroupOrmEntity,
  PoozabeduStudentOrmEntity,
  MaxLinkTokenOrmEntity,
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
        // Автоматически прогоняем недостающие миграции при старте контейнера.
        // Все наши миграции писаны идемпотентно (IF NOT EXISTS) — повторный
        // прогон безопасен. typeorm пропустит уже отмеченные в `migrations` таблице.
        migrationsRun: true,
        // glob `*.{ts,js}` работает и в dev (ts-node читает .ts), и в production
        // (Node читает скомпилированные .js из dist). __dirname укажет в нужное место.
        migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
        migrationsTableName: 'migrations',
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
    TypeOrmReportExportRepository,
    TypeOrmApplicationRepository,
    TypeOrmDisciplineRepository,
    TypeOrmCurriculumPlanRepository,
    TypeOrmCurriculumEntryRepository,
    TypeOrmGradeSheetRepository,
    TypeOrmGradeRepository,
    TypeOrmApplicantRepository,
    TypeOrmPassRepository,
    TypeOrmCertificateRequestRepository,
    TypeOrmCommentOptionRepository,
    TypeOrmPoozabeduDepartmentRepository,
    TypeOrmPoozabeduStudentGroupRepository,
    TypeOrmPoozabeduStudentRepository,
    { provide: USER_REPOSITORY,             useExisting: TypeOrmUserRepository },
    { provide: AUDIT_LOG_REPOSITORY,        useExisting: TypeOrmAuditLogRepository },
    { provide: GROUP_REPOSITORY,            useExisting: TypeOrmGroupRepository },
    { provide: STUDENT_REPOSITORY,          useExisting: TypeOrmStudentRepository },
    { provide: STUDENT_DOCUMENT_REPOSITORY, useExisting: TypeOrmStudentDocumentRepository },
    { provide: REPORT_EXPORT_REPOSITORY,    useExisting: TypeOrmReportExportRepository },
    { provide: APPLICATION_REPOSITORY,      useExisting: TypeOrmApplicationRepository },
    { provide: DISCIPLINE_REPOSITORY,      useExisting: TypeOrmDisciplineRepository },
    { provide: CURRICULUM_PLAN_REPOSITORY, useExisting: TypeOrmCurriculumPlanRepository },
    { provide: CURRICULUM_ENTRY_REPOSITORY,useExisting: TypeOrmCurriculumEntryRepository },
    { provide: GRADE_SHEET_REPOSITORY,     useExisting: TypeOrmGradeSheetRepository },
    { provide: GRADE_REPOSITORY,           useExisting: TypeOrmGradeRepository },
    { provide: APPLICANT_REPOSITORY,       useExisting: TypeOrmApplicantRepository },
    { provide: PASS_REPOSITORY,            useExisting: TypeOrmPassRepository },
    { provide: CERTIFICATE_REQUEST_REPOSITORY, useExisting: TypeOrmCertificateRequestRepository },
    { provide: COMMENT_OPTION_REPOSITORY,      useExisting: TypeOrmCommentOptionRepository },
    { provide: POOZABEDU_DEPARTMENT_REPOSITORY, useExisting: TypeOrmPoozabeduDepartmentRepository },
    { provide: POOZABEDU_STUDENT_GROUP_REPOSITORY, useExisting: TypeOrmPoozabeduStudentGroupRepository },
    { provide: POOZABEDU_STUDENT_REPOSITORY,    useExisting: TypeOrmPoozabeduStudentRepository },
  ],
  exports: [
    USER_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    GROUP_REPOSITORY,
    STUDENT_REPOSITORY,
    STUDENT_DOCUMENT_REPOSITORY,
    REPORT_EXPORT_REPOSITORY,
    APPLICATION_REPOSITORY,
    DISCIPLINE_REPOSITORY,
    CURRICULUM_PLAN_REPOSITORY,
    CURRICULUM_ENTRY_REPOSITORY,
    GRADE_SHEET_REPOSITORY,
    GRADE_REPOSITORY,
    APPLICANT_REPOSITORY,
    PASS_REPOSITORY,
    CERTIFICATE_REQUEST_REPOSITORY,
    COMMENT_OPTION_REPOSITORY,
    POOZABEDU_DEPARTMENT_REPOSITORY,
    POOZABEDU_STUDENT_GROUP_REPOSITORY,
    POOZABEDU_STUDENT_REPOSITORY,
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
