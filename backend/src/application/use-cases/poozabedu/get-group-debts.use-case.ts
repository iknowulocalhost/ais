import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import {
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/** Долги студентов группы (rating.notCertified + attestation.subjects). */
@Injectable()
export class GetGroupDebtsUseCase {
  constructor(
    private readonly api: PoozabeduApiClient,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(groupExternalId: number): Promise<GroupDebtsResult> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const term = today.getMonth() < 7 ? 2 : 1;

    const [att, rating] = await this.api.withSession(async () =>
      Promise.all([
        this.api.getReport(`curator/group-attestation/${groupExternalId}`).catch(() => null),
        this.api.getReport(`curator/rating/Semester/${term}/${todayIso}/${groupExternalId}`).catch(() => null),
      ]),
    );

    // Имена студентов и базовые данные — берём из нашего зеркала, не из rating
    // (там бывают артефакты с переводами).
    const { items: mirrorStudents } = await this.students.list(
      { groupExternalId, isActive: true },
      500,
      0,
    );

    const ratingStudents = pickRatingStudents(rating);
    const debtSubjectsByStudent = pickDebtSubjects(att);

    const rows: GroupDebtRow[] = [];
    for (const s of mirrorStudents) {
      const r = ratingStudents.get(s.externalId);
      const count = r?.notCertified ?? 0;
      const subjects = debtSubjectsByStudent.get(s.externalId) ?? [];
      // Считаем должником, если rating сказал «не аттестован» хоть по одному
      // ИЛИ если в аттестации видны явные несдачи.
      if (count > 0 || subjects.length > 0) {
        rows.push({
          studentExternalId: s.externalId,
          lastName: s.lastName,
          firstName: s.firstName,
          middleName: s.middleName,
          count: Math.max(count, subjects.length),
          subjects: subjects.slice(0, 5),
        });
      }
    }

    rows.sort((a, b) => b.count - a.count || a.lastName.localeCompare(b.lastName, 'ru'));

    await this.audit.record({
      ctx,
      action: 'READ_SENSITIVE',
      entity: 'PoozabeduGroupDebts',
      entityId: String(groupExternalId),
      meta: { groupExternalId, term, todayIso, debtors: rows.length },
    });

    return { groupExternalId, term, year: today.getFullYear(), rows };
  }
}

/* ─── типы ─── */

export interface GroupDebtRow {
  studentExternalId: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
  count: number;
  subjects: string[];
}

export interface GroupDebtsResult {
  groupExternalId: number;
  term: number;
  year: number;
  rows: GroupDebtRow[];
}

/* ─── helpers ─── */

const DEBT_VALUES = new Set(['Two', 'One', 'Zero', 'Unsatisfactory', 'Absent']);

function pickRatingStudents(payload: unknown): Map<number, { notCertified: number }> {
  const out = new Map<number, { notCertified: number }>();
  if (!payload || typeof payload !== 'object') return out;
  const students = (payload as {
    students?: Array<{ id: number; progress?: { notCertified?: number } }>;
  }).students;
  if (!Array.isArray(students)) return out;
  for (const s of students) {
    const nc = s.progress?.notCertified ?? 0;
    if (nc > 0) out.set(s.id, { notCertified: nc });
  }
  return out;
}

function pickDebtSubjects(payload: unknown): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!payload || typeof payload !== 'object') return out;
  const subjects = (payload as {
    subjects?: Array<{
      name?: string;
      marks?: Record<string, { value?: string; isRequired?: boolean }>;
    }>;
  }).subjects;
  if (!Array.isArray(subjects)) return out;
  for (const subj of subjects) {
    if (!subj.name || !subj.marks) continue;
    for (const [sidStr, m] of Object.entries(subj.marks)) {
      const sid = Number(sidStr);
      if (!Number.isFinite(sid)) continue;
      const isDebt =
        (m.value && DEBT_VALUES.has(m.value)) ||
        (m.isRequired && (!m.value || m.value === 'None'));
      if (!isDebt) continue;
      const arr = out.get(sid) ?? [];
      if (!arr.includes(subj.name)) arr.push(subj.name);
      out.set(sid, arr);
    }
  }
  return out;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
