import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { SubmitApplicationUseCase } from '../../../application/use-cases/applications/submit-application.use-case';
import { ListApplicationsUseCase } from '../../../application/use-cases/applications/list-applications.use-case';
import { ReviewApplicationUseCase } from '../../../application/use-cases/applications/review-application.use-case';
import { BatchEnrollUseCase } from '../../../application/use-cases/applications/batch-enroll.use-case';
import {
  BatchEnrollDto,
  ListApplicationsQueryDto,
  ReviewApplicationDto,
  SubmitApplicationDto,
} from '../dto/application.dto';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository';
import { Inject } from '@nestjs/common';
import { Application } from '../../../domain/entities/application.entity';
import { Throttle } from '@nestjs/throttler';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly submit: SubmitApplicationUseCase,
    private readonly listUc: ListApplicationsUseCase,
    private readonly review: ReviewApplicationUseCase,
    private readonly batchEnroll: BatchEnrollUseCase,
    @Inject(APPLICATION_REPOSITORY) private readonly apps: ApplicationRepository,
  ) {}

  /** Публичная форма подачи заявки. Троттлим жёстко — защита от спама. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async create(@Body() dto: SubmitApplicationDto) {
    const saved = await this.submit.execute(dto);
    return { id: saved.id, status: saved.status };
  }

  @Roles(Role.ADM, Role.COM)
  @Get()
  async list(@Query() q: ListApplicationsQueryDto) {
    const res = await this.listUc.execute(
      { status: q.status, programCode: q.programCode, search: q.search },
      q.limit ?? 50,
      q.offset ?? 0,
    );
    return { total: res.total, items: res.items.map((a) => this.serialize(a)) };
  }

  @Roles(Role.ADM, Role.COM)
  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const a = await this.apps.findById(id);
    if (!a) throw new NotFoundException();
    return this.serialize(a);
  }

  @Roles(Role.ADM, Role.COM)
  @Post(':id/review')
  async doReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    await this.review.execute({
      applicationId: id,
      decision: dto.decision,
      reason: dto.reason ?? null,
    });
    return { ok: true };
  }

  @Roles(Role.ADM, Role.COM)
  @Post('batch-enroll')
  async batch(@Body() dto: BatchEnrollDto) {
    return this.batchEnroll.execute({
      applicationIds: dto.applicationIds,
      groupId: dto.groupId,
    });
  }

  private serialize(a: Application) {
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      middleName: a.middleName,
      birthDate: a.birthDate,
      email: a.email,
      phone: a.phone,
      programCode: a.programCode,
      status: a.status,
      rejectionReason: a.rejectionReason,
      reviewerId: a.reviewerId,
      studentId: a.studentId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
