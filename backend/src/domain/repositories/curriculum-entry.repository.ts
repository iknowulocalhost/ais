import { CurriculumEntry } from '../entities/curriculum-entry.entity';

export abstract class CurriculumEntryRepository {
  abstract findById(id: string): Promise<CurriculumEntry | null>;
  abstract findByPlanId(planId: string): Promise<CurriculumEntry[]>;
  abstract create(e: CurriculumEntry): Promise<CurriculumEntry>;
  abstract update(e: CurriculumEntry): Promise<CurriculumEntry>;
  abstract delete(id: string): Promise<void>;
}

export const CURRICULUM_ENTRY_REPOSITORY = Symbol('CURRICULUM_ENTRY_REPOSITORY');
