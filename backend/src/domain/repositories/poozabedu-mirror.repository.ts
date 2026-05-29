import {
  PoozabeduDepartment,
  PoozabeduStudent,
  PoozabeduStudentGroup,
} from '../entities/poozabedu-mirror.entity';

export interface PoozabeduStudentFilter {
  search?: string;          // по ФИО
  groupExternalId?: number;
  /** Если задан — оставляем только студентов из перечисленных групп (для TEA). */
  groupExternalIdsAllowed?: number[];
  isActive?: boolean;
}

export abstract class PoozabeduDepartmentRepository {
  abstract upsertMany(items: PoozabeduDepartment[]): Promise<void>;
  abstract deactivateExcept(externalIds: number[]): Promise<number>;
  abstract listAll(): Promise<PoozabeduDepartment[]>;
}

export abstract class PoozabeduStudentGroupRepository {
  abstract upsertMany(items: PoozabeduStudentGroup[]): Promise<void>;
  abstract deactivateExcept(externalIds: number[]): Promise<number>;
  abstract listAll(): Promise<PoozabeduStudentGroup[]>;
  /** Group external_ids, которыми руководит указанный сотрудник (curatorExternalId). */
  abstract listOwnedExternalIdsByCurator(curatorExternalId: number): Promise<number[]>;
}

export abstract class PoozabeduStudentRepository {
  abstract upsertMany(items: PoozabeduStudent[]): Promise<void>;
  abstract deactivateExcept(externalIds: number[]): Promise<number>;
  abstract list(
    filter: PoozabeduStudentFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: PoozabeduStudent[]; total: number }>;
  abstract findByExternalId(externalId: number): Promise<PoozabeduStudent | null>;
  /** Точный матч по ФИО (case-insensitive, пробелы trim). */
  abstract findByFullName(
    lastName: string,
    firstName: string,
    middleName: string | null,
  ): Promise<PoozabeduStudent[]>;
}

export const POOZABEDU_DEPARTMENT_REPOSITORY = Symbol('POOZABEDU_DEPARTMENT_REPOSITORY');
export const POOZABEDU_STUDENT_GROUP_REPOSITORY = Symbol('POOZABEDU_STUDENT_GROUP_REPOSITORY');
export const POOZABEDU_STUDENT_REPOSITORY = Symbol('POOZABEDU_STUDENT_REPOSITORY');
