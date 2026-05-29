import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/** Семестровая статистика студента: средний балл, посещаемость и долги. */
@Injectable()
export class GetCollegeGpaUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(studentExternalId: number): Promise<SemesterStatsResult> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const detail = await this.api.withSession(() => this.api.getStudentDetail(studentExternalId));
    const groupId = detail.studentGroup?.id;
    if (!groupId) throw new NotFoundException('Студент не привязан к группе');

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const currentTerm = today.getMonth() < 7 ? 2 : 1; // до конца июля — II, иначе I
    const prevTerm = currentTerm === 1 ? 2 : 1;

    const [currAtt, currRating, prevRating] = await this.api.withSession(async () =>
      Promise.all([
        this.api.getReport(`curator/group-attestation/${groupId}`).catch(() => null),
        this.api.getReport(`curator/rating/Semester/${currentTerm}/${todayIso}/${groupId}`).catch(() => null),
        this.api.getReport(`curator/rating/Semester/${prevTerm}/${todayIso}/${groupId}`).catch(() => null),
      ]),
    );

    const currStats = buildTermStats(today.getFullYear(), currentTerm, currAtt, currRating, studentExternalId);
    const prevStats = buildTermStats(today.getFullYear(), prevTerm, null, prevRating, studentExternalId);

    const totalSum = currStats._sum + prevStats._sum;
    const totalCount = currStats._count + prevStats._count;
    const gpa = totalCount > 0 ? round2(totalSum / totalCount) : null;

    const gpaDelta =
      currStats.gpa !== null && prevStats.gpa !== null
        ? round2(currStats.gpa - prevStats.gpa)
        : null;

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduStudentGpa',
      entityId: String(studentExternalId),
      meta: { studentExternalId, currentTerm, prevTerm },
    });

    return {
      gpa,
      gpaDelta,
      sampleSize: totalCount,
      currentTerm: currStats,
      previousTerm: prevStats,
      perTerm: [currStats, prevStats],
    };
  }
}

/* ─────────── типы публичного ответа ─────────── */

export interface TermStats {
  year: number;
  term: number;
  /** Средний балл за семестр (либо null, если оценок нет). */
  gpa: number | null;
  /** По скольким дисциплинам посчитан балл. */
  count: number;
  /** Часы пропусков — всего. */
  attendanceMissedAll: number;
  /** Часы пропусков без уважительной причины. */
  attendanceMissedInvalid: number;
  /** Сколько дисциплин «не аттестован». */
  debtsCount: number;
  /** Названия дисциплин-долгов (для отображения в KPI). */
  debtsSubjects: string[];
  /** Внутреннее: сумма/число баллов — для агрегации в общий GPA. */
  _sum: number;
  _count: number;
}

export interface SemesterStatsResult {
  gpa: number | null;
  gpaDelta: number | null;
  sampleSize: number;
  currentTerm: TermStats;
  previousTerm: TermStats;
  /** Для совместимости со старым фронтом — оба семестра подряд. */
  perTerm: TermStats[];
}

/* ─────────── helpers ─────────── */

const NUMERIC_MARK: Record<string, number> = {
  Five: 5, Excellent: 5,
  Four: 4, Good: 4,
  Three: 3, Satisfactory: 3,
  Two: 2, Unsatisfactory: 2,
  One: 1,
  Zero: 0,
};

const DEBT_VALUES = new Set(['Two', 'One', 'Zero', 'Unsatisfactory', 'Absent']);

function buildTermStats(
  year: number,
  term: number,
  attPayload: unknown,
  ratingPayload: unknown,
  studentExternalId: number,
): TermStats {
  const marks = collectMarks(attPayload, studentExternalId);
  const debts = collectDebts(attPayload, studentExternalId);
  const att = collectAttendance(ratingPayload, studentExternalId);
  return {
    year,
    term,
    gpa: marks.count > 0 ? round2(marks.sum / marks.count) : null,
    count: marks.count,
    attendanceMissedAll: att.all,
    attendanceMissedInvalid: att.invalid,
    debtsCount: debts.length,
    debtsSubjects: debts,
    _sum: marks.sum,
    _count: marks.count,
  };
}

function collectMarks(payload: unknown, studentExternalId: number): { sum: number; count: number } {
  if (!payload || typeof payload !== 'object') return { sum: 0, count: 0 };
  const subjects = (payload as { subjects?: Array<{ marks?: Record<string, { value?: string }> }> }).subjects;
  if (!Array.isArray(subjects)) return { sum: 0, count: 0 };
  const sid = String(studentExternalId);
  let sum = 0;
  let count = 0;
  for (const subj of subjects) {
    const v = subj.marks?.[sid]?.value;
    if (!v) continue;
    const n = NUMERIC_MARK[v];
    if (typeof n === 'number') {
      sum += n;
      count += 1;
    }
  }
  return { sum, count };
}

function collectDebts(payload: unknown, studentExternalId: number): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const subjects = (payload as { subjects?: Array<{ name?: string; marks?: Record<string, { value?: string; isRequired?: boolean }> }> }).subjects;
  if (!Array.isArray(subjects)) return [];
  const sid = String(studentExternalId);
  const out: string[] = [];
  for (const subj of subjects) {
    const m = subj.marks?.[sid];
    if (!m) continue;
    if (m.value && DEBT_VALUES.has(m.value)) {
      if (subj.name) out.push(subj.name);
    } else if (m.isRequired && (!m.value || m.value === 'None')) {
      if (subj.name) out.push(subj.name);
    }
  }
  return out;
}

function collectAttendance(
  payload: unknown,
  studentExternalId: number,
): { all: number; invalid: number } {
  if (!payload || typeof payload !== 'object') return { all: 0, invalid: 0 };
  const students = (payload as {
    students?: Array<{
      id: number;
      attendance?: { allMissed?: number; missedForInvalidReason?: number };
    }>;
  }).students;
  if (!Array.isArray(students)) return { all: 0, invalid: 0 };
  const me = students.find((s) => s.id === studentExternalId);
  return {
    all: me?.attendance?.allMissed ?? 0,
    invalid: me?.attendance?.missedForInvalidReason ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
