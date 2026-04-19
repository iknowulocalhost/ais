import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import { Student, StudentStatus } from '../../../domain/entities/student.entity';
import { AuditContext, AuditService } from '../../services/audit.service';

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  birthDate: string; // ISO
  status?: StudentStatus;
  groupId?: string | null;
  userId?: string | null;
}

@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    private readonly audit: AuditService,
  ) {}

  async execute(input: CreateStudentInput, ctx: AuditContext): Promise<Student> {
    const now = new Date();
    const student = new Student(
      randomUUID(),
      input.userId ?? null,
      input.groupId ?? null,
      input.firstName,
      input.lastName,
      input.middleName ?? null,
      new Date(input.birthDate),
      input.status ?? 'APPLICANT',
      null,
      now,
      now,
    );
    const saved = await this.students.create(student);

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'Student',
      entityId: saved.id,
      newState: {
        firstName: saved.firstName,
        lastName: saved.lastName,
        status: saved.status,
        groupId: saved.groupId,
      },
    });

    return saved;
  }
}
