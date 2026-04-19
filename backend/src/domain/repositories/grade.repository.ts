import { Grade } from '../entities/grade.entity';

export abstract class GradeRepository {
  abstract findById(id: string): Promise<Grade | null>;
  abstract findBySheetId(sheetId: string): Promise<Grade[]>;
  abstract findByStudentId(studentId: string): Promise<Grade[]>;
  abstract create(g: Grade): Promise<Grade>;
  abstract createMany(grades: Grade[]): Promise<Grade[]>;
  abstract update(g: Grade): Promise<Grade>;
  abstract delete(id: string): Promise<void>;
}

export const GRADE_REPOSITORY = Symbol('GRADE_REPOSITORY');
