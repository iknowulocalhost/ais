import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  GRADE_SHEET_REPOSITORY,
  GradeSheetRepository,
} from '../../../domain/repositories/grade-sheet.repository';
import {
  CURRICULUM_ENTRY_REPOSITORY,
  CurriculumEntryRepository,
} from '../../../domain/repositories/curriculum-entry.repository';
import {
  GROUP_REPOSITORY,
  GroupRepository,
} from '../../../domain/repositories/group.repository';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import {
  GRADE_REPOSITORY,
  GradeRepository,
} from '../../../domain/repositories/grade.repository';
import { GradeSheet } from '../../../domain/entities/grade-sheet.entity';
import { Grade } from '../../../domain/entities/grade.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface CreateGradeSheetInput {
  groupId: string;
  curriculumEntryId: string;
  teacherId: string;
  date: string; // ISO
}

@Injectable()
export class CreateGradeSheetUseCase {
  constructor(
    @Inject(GRADE_SHEET_REPOSITORY) private readonly sheets: GradeSheetRepository,
    @Inject(CURRICULUM_ENTRY_REPOSITORY) private readonly entries: CurriculumEntryRepository,
    @Inject(GROUP_REPOSITORY) private readonly groups: GroupRepository,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: CreateGradeSheetInput): Promise<GradeSheet> {
    const group = await this.groups.findById(input.groupId);
    if (!group) throw new NotFoundException('Группа не найдена');

    const entry = await this.entries.findById(input.curriculumEntryId);
    if (!entry) throw new NotFoundException('Запись учебного плана не найдена');

    const now = new Date();
    const sheet = new GradeSheet(
      randomUUID(),
      input.groupId,
      input.curriculumEntryId,
      input.teacherId,
      new Date(input.date),
      'OPEN',
      now,
      now,
    );
    const saved = await this.sheets.create(sheet);

    // Автоматически создаём пустые оценки для всех студентов группы
    const { items: groupStudents } = await this.students.list(
      { groupId: input.groupId, status: 'ENROLLED' },
      1000,
      0,
    );
    if (groupStudents.length > 0) {
      const emptyGrades = groupStudents.map(
        (s) => new Grade(randomUUID(), saved.id, s.id, null, null, now, now),
      );
      await this.grades.createMany(emptyGrades);
    }

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'GradeSheet',
      entityId: saved.id,
      newState: {
        groupId: saved.groupId,
        curriculumEntryId: saved.curriculumEntryId,
        teacherId: saved.teacherId,
        date: saved.date,
        studentsCount: groupStudents.length,
      },
    });
    return saved;
  }
}
