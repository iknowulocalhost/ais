import { CurriculumPlan, CurriculumPlanStatus } from '../entities/curriculum-plan.entity';

export interface CurriculumPlanFilter {
  programCode?: string;
  admissionYear?: number;
  status?: CurriculumPlanStatus;
}

export abstract class CurriculumPlanRepository {
  abstract findById(id: string): Promise<CurriculumPlan | null>;
  abstract create(p: CurriculumPlan): Promise<CurriculumPlan>;
  abstract update(p: CurriculumPlan): Promise<CurriculumPlan>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: CurriculumPlanFilter, limit: number, offset: number): Promise<{ items: CurriculumPlan[]; total: number }>;
}

export const CURRICULUM_PLAN_REPOSITORY = Symbol('CURRICULUM_PLAN_REPOSITORY');
