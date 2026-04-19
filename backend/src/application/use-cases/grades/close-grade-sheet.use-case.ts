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
import { GradeSheet } from '../../../domain/entities/grade-sheet.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

@Injectable()
export class CloseGradeSheetUseCase {
  constructor(
    @Inject(GRADE_SHEET_REPOSITORY) private readonly sheets: GradeSheetRepository,
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(sheetId: string, actorId: string, isAdmin: boolean): Promise<GradeSheet> {
    const sheet = await this.sheets.findById(sheetId);
    if (!sheet) throw new NotFoundException('Ведомость не найдена');
    if (sheet.status === 'CLOSED') return sheet;

    // Только TEA-владелец или ADM может закрыть
    if (!isAdmin && sheet.teacherId !== actorId) {
      throw new ForbiddenException('Закрыть может только преподаватель ведомости или ADM');
    }

    // Проверяем, что все оценки выставлены
    const grades = await this.grades.findBySheetId(sheetId);
    const unfilled = grades.filter((g) => g.value === null);
    if (unfilled.length > 0) {
      throw new BadRequestException(
        `Не у всех студентов выставлены оценки (не заполнено: ${unfilled.length})`,
      );
    }

    sheet.close();
    const saved = await this.sheets.update(sheet);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'UPDATE',
      entity: 'GradeSheet',
      entityId: saved.id,
      oldState: { status: 'OPEN' },
      newState: { status: 'CLOSED' },
    });
    return saved;
  }
}
