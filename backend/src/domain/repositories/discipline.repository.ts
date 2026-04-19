import { Discipline } from '../entities/discipline.entity';

export interface DisciplineFilter {
  search?: string;  // по названию или коду
}

export abstract class DisciplineRepository {
  abstract findById(id: string): Promise<Discipline | null>;
  abstract findByCode(code: string): Promise<Discipline | null>;
  abstract create(d: Discipline): Promise<Discipline>;
  abstract update(d: Discipline): Promise<Discipline>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: DisciplineFilter, limit: number, offset: number): Promise<{ items: Discipline[]; total: number }>;
}

export const DISCIPLINE_REPOSITORY = Symbol('DISCIPLINE_REPOSITORY');
