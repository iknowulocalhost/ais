import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './controllers/audit.controller';
import { AuditService } from '../../application/services/audit.service';
import { SecurityAlertService } from '../../application/services/security-alert.service';
import { HttpAuditInterceptor } from '../../infrastructure/context/http-audit.interceptor';
import { AuditDeniedFilter } from '../../infrastructure/context/audit-denied.filter';
import { UserOrmEntity } from '../../infrastructure/database/entities/user.orm-entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [AuditController],
  providers: [
    AuditService,
    SecurityAlertService,
    { provide: APP_INTERCEPTOR, useClass: HttpAuditInterceptor },
    { provide: APP_FILTER, useClass: AuditDeniedFilter },
  ],
  exports: [SecurityAlertService],
})
export class AuditModule {}
