import { Pass, PassStatus } from '../entities/pass.entity';

export interface PassFilter {
  status?: PassStatus;
  search?: string; // по ФИО/группе
  /** Если задан — возвращаем только заявки этого пользователя (для STU-роли). */
  submitterUserId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export abstract class PassRepository {
  abstract findById(id: string): Promise<Pass | null>;
  abstract create(p: Pass): Promise<Pass>;
  abstract update(p: Pass): Promise<Pass>;
  abstract list(
    filter: PassFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: Pass[]; total: number }>;
}

export const PASS_REPOSITORY = Symbol('PASS_REPOSITORY');
