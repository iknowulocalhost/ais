import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GRADE_SHEET_REPOSITORY,
  GradeSheetRepository,
} from '../../../domain/repositories/grade-sheet.repository';
import {
  GRADE_REPOSITORY,
  GradeRepository,
} from '../../../domain/repositories/grade.repository';
import { Grade } from '../../../domain/entities/grade.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface GradeInput {
  gradeId: string;
  value: number;
  comment?: string | null;
}

export interface SubmitGradesInput {
  sheetId: string;
  grades: GradeInput[];
}

@Injectable()
export class SubmitGradesUseCase {
  constructor(
    @Inject(GRADE_SHEET_REPOSITORY) private readonly sheets: GradeSheetRepository,
    @Inject(GRADE_REPOSITORY) private readonly gradeRepo: GradeRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: SubmitGradesInput, actorId: string): Promise<Grade[]> {
    const sheet = await this.sheets.findById(input.sheetId);
    if (!sheet) throw new NotFoundException('Ведомость не найдена');
    if (sheet.status === 'CLOSED') throw new BadRequestException('Ведомость закрыта');
    if (sheet.teacherId !== actorId) {
      throw new ForbiddenException('Выставлять оценки может только преподаватель ведомости');
    }

    const existing = await this.gradeRepo.findBySheetId(input.sheetId);
    const gradeMap = new Map(existing.map((g) => [g.id, g]));

    const updated: Grade[] = [];
    for (const gi of input.grades) {
      const grade = gradeMap.get(gi.gradeId);
      if (!grade) throw new NotFoundException(`Оценка ${gi.gradeId} не найдена в ведомости`);
      const oldValue = grade.value;
      grade.setValue(gi.value, gi.comment ?? null);
      const saved = await this.gradeRepo.update(grade);
      updated.push(saved);

      await this.audit.record({
        ctx: this.reqCtx.get(),
        action: 'UPDATE',
        entity: 'Grade',
        entityId: grade.id,
        oldState: { value: oldValue },
        newState: { value: gi.value, comment: gi.comment ?? null },
      });
    }
    return updated;
  }
}
