import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CreateDisciplineUseCase } from '../../../application/use-cases/curriculum/create-discipline.use-case';
import { CreateCurriculumPlanUseCase } from '../../../application/use-cases/curriculum/create-curriculum-plan.use-case';
import { AddCurriculumEntryUseCase } from '../../../application/use-cases/curriculum/add-curriculum-entry.use-case';
import {
  DISCIPLINE_REPOSITORY,
  DisciplineRepository,
} from '../../../domain/repositories/discipline.repository';
import {
  CURRICULUM_PLAN_REPOSITORY,
  CurriculumPlanRepository,
} from '../../../domain/repositories/curriculum-plan.repository';
import {
  CURRICULUM_ENTRY_REPOSITORY,
  CurriculumEntryRepository,
} from '../../../domain/repositories/curriculum-entry.repository';
import {
  AddCurriculumEntryDto,
  CreateCurriculumPlanDto,
  CreateDisciplineDto,
  ListCurriculumPlansQueryDto,
  ListDisciplinesQueryDto,
} from '../dto/curriculum.dto';

@Controller('curriculum')
export class CurriculumController {
  constructor(
    private readonly createDisciplineUC: CreateDisciplineUseCase,
    private readonly createPlanUC: CreateCurriculumPlanUseCase,
    private readonly addEntryUC: AddCurriculumEntryUseCase,
    @Inject(DISCIPLINE_REPOSITORY) private readonly disciplines: DisciplineRepository,
    @Inject(CURRICULUM_PLAN_REPOSITORY) private readonly plans: CurriculumPlanRepository,
    @Inject(CURRICULUM_ENTRY_REPOSITORY) private readonly entries: CurriculumEntryRepository,
  ) {}

  // ── Disciplines ─────────────────────────────────────────

  @Roles(Role.ADM)
  @Post('disciplines')
  create(@Body() dto: CreateDisciplineDto) {
    return this.createDisciplineUC.execute(dto);
  }

  @Roles(Role.ADM, Role.TEA, Role.ADMINISTRATION)
  @Get('disciplines')
  listDisciplines(
    @Query() q: ListDisciplinesQueryDto,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    return this.disciplines.list({ search: q.search }, lim, off);
  }

  @Roles(Role.ADM, Role.TEA, Role.ADMINISTRATION)
  @Get('disciplines/:id')
  async oneDiscipline(@Param('id', new ParseUUIDPipe()) id: string) {
    const d = await this.disciplines.findById(id);
    if (!d) throw new NotFoundException();
    return d;
  }

  // ── Plans ───────────────────────────────────────────────

  @Roles(Role.ADM)
  @Post('plans')
  createPlan(@Body() dto: CreateCurriculumPlanDto) {
    return this.createPlanUC.execute(dto);
  }

  @Roles(Role.ADM, Role.TEA, Role.ADMINISTRATION)
  @Get('plans')
  listPlans(
    @Query() q: ListCurriculumPlansQueryDto,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    return this.plans.list(
      { programCode: q.programCode, admissionYear: q.admissionYear, status: q.status },
      lim,
      off,
    );
  }

  @Roles(Role.ADM, Role.TEA, Role.ADMINISTRATION)
  @Get('plans/:id')
  async onePlan(@Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.plans.findById(id);
    if (!p) throw new NotFoundException();
    return p;
  }

  @Roles(Role.ADM, Role.TEA, Role.ADMINISTRATION)
  @Get('plans/:id/entries')
  async planEntries(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.entries.findByPlanId(id);
  }

  @Roles(Role.ADM)
  @Post('plans/:id/entries')
  addEntry(
    @Param('id', new ParseUUIDPipe()) planId: string,
    @Body() dto: AddCurriculumEntryDto,
  ) {
    return this.addEntryUC.execute({ planId, ...dto });
  }

  @Roles(Role.ADM)
  @Post('plans/:id/activate')
  async activatePlan(@Param('id', new ParseUUIDPipe()) id: string) {
    const plan = await this.plans.findById(id);
    if (!plan) throw new NotFoundException();
    plan.activate();
    return this.plans.update(plan);
  }

  @Roles(Role.ADM)
  @Post('plans/:id/archive')
  async archivePlan(@Param('id', new ParseUUIDPipe()) id: string) {
    const plan = await this.plans.findById(id);
    if (!plan) throw new NotFoundException();
    plan.archive();
    return this.plans.update(plan);
  }

  @Roles(Role.ADM)
  @Delete('plans/:planId/entries/:entryId')
  async deleteEntry(
    @Param('planId', new ParseUUIDPipe()) _planId: string,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
  ) {
    await this.entries.delete(entryId);
    return { deleted: true };
  }
}
