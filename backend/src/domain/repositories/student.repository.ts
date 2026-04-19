import { Student, StudentStatus } from '../entities/student.entity';

export interface StudentFilter {
  status?: StudentStatus;
  groupId?: string;
  search?: string; // по ФИО
}

export abstract class StudentRepository {
  abstract findById(id: string): Promise<Student | null>;
  abstract findByUserId(userId: string): Promise<Student | null>;
  abstract create(student: Student): Promise<Student>;
  abstract update(student: Student): Promise<Student>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: StudentFilter, limit: number, offset: number): Promise<{ items: Student[]; total: number }>;
}

export const STUDENT_REPOSITORY = Symbol('STUDENT_REPOSITORY');
