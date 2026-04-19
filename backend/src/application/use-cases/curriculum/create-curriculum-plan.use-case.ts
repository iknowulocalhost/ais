import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CURRICULUM_PLAN_REPOSITORY,
  CurriculumPlanRepository,
} from '../../../domain/repositories/curriculum-plan.repository';
import { CurriculumPlan } from '../../../domain/entities/curriculum-plan.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface CreateCurriculumPlanInput {
  programCode: string;
  admissionYear: number;
  name: string;
}

@Injectable()
export class CreateCurriculumPlanUseCase {
  constructor(
    @Inject(CURRICULUM_PLAN_REPOSITORY) private readonly plans: CurriculumPlanRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: CreateCurriculumPlanInput): Promise<CurriculumPlan> {
    const now = new Date();
    const plan = new CurriculumPlan(
      randomUUID(),
      input.programCode,
      input.admissionYear,
      input.name,
      'DRAFT',
      now,
      now,
    );
    const saved = await this.plans.create(plan);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'CurriculumPlan',
      entityId: saved.id,
      newState: { programCode: saved.programCode, admissionYear: saved.admissionYear, name: saved.name },
    });
    return saved;
  }
}
