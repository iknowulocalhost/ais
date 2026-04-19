import { GradeSheet, GradeSheetStatus } from '../entities/grade-sheet.entity';

export interface GradeSheetFilter {
  groupId?: string;
  teacherId?: string;
  status?: GradeSheetStatus;
  curriculumEntryId?: string;
}

export abstract class GradeSheetRepository {
  abstract findById(id: string): Promise<GradeSheet | null>;
  abstract create(s: GradeSheet): Promise<GradeSheet>;
  abstract update(s: GradeSheet): Promise<GradeSheet>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: GradeSheetFilter, limit: number, offset: number): Promise<{ items: GradeSheet[]; total: number }>;
}

export const GRADE_SHEET_REPOSITORY = Symbol('GRADE_SHEET_REPOSITORY');
