import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RequestExportUseCase } from '../../../application/use-cases/reports/request-export.use-case';
import {
  REPORT_EXPORT_REPOSITORY,
  ReportExportRepository,
} from '../../../domain/repositories/report-export.repository';
import {
  OBJECT_STORAGE,
  ObjectStorage,
  BUCKETS,
} from '../../../domain/services/object-storage';
import { ReportKind } from '../../../domain/entities/report-export.entity';

class RequestExportDto {
  @IsEnum(['STUDENTS_ROSTER', 'PAYMENTS_LEDGER'])
  kind!: ReportKind;

  @IsOptional() @IsObject()
  params?: Record<string, unknown>;
}

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly requestUC: RequestExportUseCase,
    @Inject(REPORT_EXPORT_REPOSITORY) private readonly reports: ReportExportRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Roles(Role.ANA, Role.ADM, Role.ACC)
  @Post('exports')
  request(@Body() dto: RequestExportDto) {
    return this.requestUC.execute(dto.kind, dto.params ?? {});
  }

  @Roles(Role.ANA, Role.ADM, Role.ACC)
  @Get('exports/:id')
  async status(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthenticatedUser) {
    const r = await this.reports.findById(id);
    if (!r) throw new NotFoundException();
    // Пользователь видит только свои отчёты (SUPERADMIN/ADM пусть смотрят любые).
    if (r.requestedBy !== actor.id && !actor.roles.includes(Role.ADM) && !actor.roles.includes(Role.SUPERADMIN)) {
      throw new ForbiddenException();
    }
    const url = r.objectKey
      ? await this.storage.getPresignedGetUrl(BUCKETS.DOCUMENTS, r.objectKey, 900)
      : null;
    return { ...r, downloadUrl: url, ttlSeconds: url ? 900 : null };
  }
}
