import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CURRICULUM_PLAN_REPOSITORY,
  CurriculumPlanRepository,
} from '../../../domain/repositories/curriculum-plan.repository';
import {
  CURRICULUM_ENTRY_REPOSITORY,
  CurriculumEntryRepository,
} from '../../../domain/repositories/curriculum-entry.repository';
import {
  DISCIPLINE_REPOSITORY,
  DisciplineRepository,
} from '../../../domain/repositories/discipline.repository';
import { CurriculumEntry, ControlForm } from '../../../domain/entities/curriculum-entry.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface AddCurriculumEntryInput {
  planId: string;
  disciplineId: string;
  semester: number;
  controlForm: ControlForm;
  hours: number;
}

@Injectable()
export class AddCurriculumEntryUseCase {
  constructor(
    @Inject(CURRICULUM_PLAN_REPOSITORY) private readonly plans: CurriculumPlanRepository,
    @Inject(CURRICULUM_ENTRY_REPOSITORY) private readonly entries: CurriculumEntryRepository,
    @Inject(DISCIPLINE_REPOSITORY) private readonly disciplines: DisciplineRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: AddCurriculumEntryInput): Promise<CurriculumEntry> {
    const plan = await this.plans.findById(input.planId);
    if (!plan) throw new NotFoundException('Учебный план не найден');
    if (plan.status === 'ARCHIVED') throw new BadRequestException('Нельзя добавлять в архивный план');

    const disc = await this.disciplines.findById(input.disciplineId);
    if (!disc) throw new NotFoundException('Дисциплина не найдена');

    if (input.semester < 1 || input.semester > 8) {
      throw new BadRequestException('Семестр должен быть от 1 до 8');
    }

    const entry = new CurriculumEntry(
      randomUUID(),
      input.planId,
      input.disciplineId,
      input.semester,
      input.controlForm,
      input.hours,
      new Date(),
    );
    const saved = await this.entries.create(entry);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'CurriculumEntry',
      entityId: saved.id,
      newState: {
        planId: saved.planId,
        disciplineId: saved.disciplineId,
        semester: saved.semester,
        controlForm: saved.controlForm,
        hours: saved.hours,
      },
    });
    return saved;
  }
}
