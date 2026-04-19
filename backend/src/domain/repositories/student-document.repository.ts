import { StudentDocument } from '../entities/student-document.entity';

export abstract class StudentDocumentRepository {
  abstract findById(id: string): Promise<StudentDocument | null>;
  abstract listByStudent(studentId: string): Promise<StudentDocument[]>;
  abstract create(doc: StudentDocument): Promise<StudentDocument>;
  abstract update(doc: StudentDocument): Promise<StudentDocument>;
  abstract delete(id: string): Promise<void>;
}

export const STUDENT_DOCUMENT_REPOSITORY = Symbol('STUDENT_DOCUMENT_REPOSITORY');
