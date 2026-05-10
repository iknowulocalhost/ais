import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { RedisModule } from './infrastructure/cache/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { ThrottlerModule } from './infrastructure/throttler/throttler.module';
import { UsersModule } from './presentation/http/users.module';
import { AuthModule } from './presentation/http/auth.module';
import { StudentsModule } from './presentation/http/students.module';
import { DocumentsModule } from './presentation/http/documents.module';
import { ReportsModule } from './presentation/http/reports.module';
import { ApplicationsModule } from './presentation/http/applications.module';
import { CurriculumModule } from './presentation/http/curriculum.module';
import { GradesModule } from './presentation/http/grades.module';
import { AdmissionsModule } from './presentation/http/admissions.module';
import { PassesModule } from './presentation/http/passes.module';
import { CertificatesModule } from './presentation/http/certificates.module';
import { CommentOptionsModule } from './presentation/http/comment-options.module';
import { LookupModule } from './presentation/http/lookup.module';
import { PoozabeduApiModule } from './infrastructure/external/poozabeduapi/poozabeduapi.module';
import { PoozabeduApiHttpModule } from './presentation/http/poozabeduapi.module';
import { AuditModule } from './presentation/http/audit.module';
import { ContextModule } from './infrastructure/context/context.module';
import { NotificationsModule } from './infrastructure/notifications/notifications.module';
import { BootstrapModule } from './infrastructure/bootstrap/bootstrap.module';
import { HealthController } from './presentation/http/controllers/health.controller';
import { JwtAuthGuard } from './presentation/http/auth/jwt-auth.guard';
import { RolesGuard } from './presentation/http/auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    ThrottlerModule,
    SecurityModule,
    StorageModule,
    QueueModule,
    ContextModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    DocumentsModule,
    ReportsModule,
    ApplicationsModule,
    CurriculumModule,
    GradesModule,
    AdmissionsModule,
    PassesModule,
    CertificatesModule,
    CommentOptionsModule,
    LookupModule,
    PoozabeduApiModule,
    PoozabeduApiHttpModule,
    AuditModule,
    BootstrapModule,
  ],
  controllers: [HealthController],
  providers: [
    // Порядок: сначала JWT (кроме @Public), затем RBAC по ролям.
    // ThrottlerGuard регистрируется в ThrottlerModule.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
