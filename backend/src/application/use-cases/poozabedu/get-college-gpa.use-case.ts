import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/**
 * Считает средний балл студента «в техникуме» — по реальным отметкам из
 * аттестационных ведомостей текущего и предыдущего семестров.
 *
 * Зачем не брать `gradePointAverage` из карточки студента: там лежит средний
 * балл аттестата при поступлении (импортируется из `attestat` в `/services/people/students`).
 * Это балл школы, а не успеваемость в колледже — и он не меняется со временем.
 *
 * Алгоритм:
 *  1. Берём детальную карточку студента → groupId.
 *  2. Получаем `curator/group-attestation/Semester/{term}/{date}/{groupId}`
 *     для текущего и предыдущего семестров.
 *  3. Для каждой дисциплины достаём оценку этого студента, переводим
 *     enum'ы Five/Four/… в числа, усредняем.
 *
 * Возвращает `null`, если оценок нет (в техникуме новичок и ему ещё ни одна
 * аттестация не выставлена).
 */
@Injectable()
export class GetCollegeGpaUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(studentExternalId: number): Promise<{
    gpa: number | null;
    sampleSize: number;
    perTerm: Array<{ year: number; term: number; average: number | null; count: number }>;
  }> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const detail = await this.api.withSession(() => this.api.getStudentDetail(studentExternalId));
    const groupId = detail.studentGroup?.id;
    if (!groupId) throw new NotFoundException('Студент не привязан к группе');

    // Берём текущий семестр и предыдущий — на стыке семестров текущий ещё пуст,
    // поэтому добавляем прошлый, чтобы не показывать «—» в начале сентября/февраля.
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const currentTerm = today.getMonth() < 7 ? 2 : 1; // упрощение: до конца июля считаем II, далее I
    const prevTerm = currentTerm === 1 ? 2 : 1;

    const [curr, prev] = await this.api.withSession(async () => Promise.all([
      this.api.getReport(`curator/group-attestation/Semester/${currentTerm}/${todayIso}/${groupId}`).catch(() => null),
      this.api.getReport(`curator/group-attestation/Semester/${prevTerm}/${todayIso}/${groupId}`).catch(() => null),
    ]));

    const currStats = collectMarks(curr, studentExternalId);
    const prevStats = collectMarks(prev, studentExternalId);
    const totalSum = currStats.sum + prevStats.sum;
    const totalCount = currStats.count + prevStats.count;
    const gpa = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : null;

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduStudentGpa',
      entityId: String(studentExternalId),
      meta: { studentExternalId, currentTerm, prevTerm },
    });

    return {
      gpa,
      sampleSize: totalCount,
      perTerm: [
        { year: today.getFullYear(), term: currentTerm, average: avg(currStats), count: currStats.count },
        { year: today.getFullYear(), term: prevTerm, average: avg(prevStats), count: prevStats.count },
      ],
    };
  }
}

const NUMERIC_MARK: Record<string, number> = {
  Five: 5, Excellent: 5,
  Four: 4, Good: 4,
  Three: 3, Satisfactory: 3,
  Two: 2, Unsatisfactory: 2,
  One: 1,
  Zero: 0,
};

function collectMarks(payload: unknown, studentExternalId: number): { sum: number; count: number } {
  if (!payload || typeof payload !== 'object') return { sum: 0, count: 0 };
  const subjects = (payload as { subjects?: Array<{ marks?: Record<string, { value?: string }> }> }).subjects;
  if (!Array.isArray(subjects)) return { sum: 0, count: 0 };
  const sid = String(studentExternalId);
  let sum = 0;
  let count = 0;
  for (const subj of subjects) {
    const m = subj.marks?.[sid];
    if (!m?.value) continue;
    const n = NUMERIC_MARK[m.value];
    if (typeof n === 'number') {
      sum += n;
      count += 1;
    }
  }
  return { sum, count };
}

function avg(s: { sum: number; count: number }): number | null {
  if (s.count === 0) return null;
  return Math.round((s.sum / s.count) * 100) / 100;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
