'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle, BookOpen, CalendarDays, FileText, GraduationCap, KeyRound, RefreshCw, UsersRound,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * Сводка для классного руководителя.
 *
 * Лёгкая часть (всегда грузится):
 *  - его группа(ы) из зеркала + количество студентов;
 *  - быстрые ссылки на /my-group, /journal, /schedule.
 *
 * Тяжёлая часть (по кнопке «Анализ за 2 недели»):
 *  - подсчёт «должников» (≥1 «двойки» за последние 14 дней по любому предмету);
 *  - кто отсутствовал/болел сегодня по любым проведённым урокам.
 *
 * Тяжёлая часть делает много upstream-запросов (по числу предметов в группе).
 * Поэтому она опциональна и запускается только по явному действию.
 */

interface MirrorGroup {
  externalId: number;
  name: string;
  yearNumber: number | null;
  isActive: boolean;
}
interface MirrorStudent {
  externalId: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
  groupExternalId: number | null;
  groupName: string | null;
  gradePointAverage: number | null;
  isActive: boolean;
}
interface JournalEntry {
  id: number;
  yearNumber: number;
  termNumber: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  scheduleSubjects: { id: number; name: string }[];
}
interface SubjectLesson {
  id: number;
  date: string;
  type: string;
  startTime?: string;
  endTime?: string;
  markSets?: Record<string, {
    absenceType?: string;
    marks?: Record<string, unknown>;
  }>;
}
interface SubjectStudent {
  id: number;
  number?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}
interface SubjectData {
  lessons: SubjectLesson[];
  students: SubjectStudent[];
}

interface RequestRow {
  id: string;
  fullName: string;
  groupName: string;
  createdAt: string;
  /** Только для справок — тип. Для пропусков отсутствует. */
  certType?: string;
}

interface DebtorRow {
  studentName: string;
  groupName: string;
  twos: { subject: string; date: string }[];
}
interface AbsenceRow {
  studentName: string;
  groupName: string;
  status: 'absent' | 'sick' | 'late' | 'excused' | 'other';
  subject: string;
  raw: string;
}

const TWO_VALUES = new Set(['Two', 'One', 'Zero', 'Unsatisfactory']);
const SICK_TYPES = new Set(['Sick', 'IsSick', 'SickLeave', 'Sickness']);
const LATE_TYPES = new Set(['IsLate']);
const EXCUSED_TYPES = new Set(['IsAbsentByValidReason', 'Excused']);
const ABSENT_TYPES = new Set(['IsAbsentByNotValidReason', 'IsAbsent']);

export function TeacherDashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MirrorGroup[] | null>(null);
  const [students, setStudents] = useState<MirrorStudent[] | null>(null);
  const [pendingCerts, setPendingCerts] = useState<RequestRow[]>([]);
  const [pendingPasses, setPendingPasses] = useState<RequestRow[]>([]);
  const [now] = useState<Date>(() => new Date());
  const [analysis, setAnalysis] = useState<{ debtors: DebtorRow[]; absences: AbsenceRow[] } | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Базовые данные: группы + полный список студентов
  useEffect(() => {
    (async () => {
      try {
        const g = await apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups');
        const active = g.filter((x) => x.isActive);
        setGroups(active);
        // подгружаем студентов всех своих групп одним запросом без groupExternalId —
        // бэк сам отфильтрует по нашей привязке (TEA видит только свои)
        const s = await apiFetch<{ items: MirrorStudent[] }>('/api/poozabeduapi/mirror/students', {
          query: { isActive: 'true', limit: 500 },
        });
        setStudents(s.items);
        // Заявки в работе по студентам моих групп. Бэк не умеет фильтровать
        // по группе напрямую, поэтому просто подтягиваем последние PENDING
        // и фильтруем на клиенте по списку групп.
        const groupNames = new Set(active.map((x) => x.name));
        const [certs, passes] = await Promise.all([
          apiFetch<{ items: (RequestRow & { status: string; certType: string })[] }>(
            '/api/certificates',
            { query: { status: 'PENDING', limit: 100 } },
          ).catch(() => ({ items: [] as (RequestRow & { status: string; certType: string })[] })),
          apiFetch<{ items: (RequestRow & { status: string; groupOrPosition?: string })[] }>(
            '/api/passes',
            { query: { status: 'PENDING', limit: 100 } },
          ).catch(() => ({ items: [] as (RequestRow & { status: string; groupOrPosition?: string })[] })),
        ]);
        setPendingCerts(certs.items.filter((c) => groupNames.has(c.groupName)));
        setPendingPasses(
          passes.items
            .filter((p) => groupNames.has(p.groupOrPosition ?? p.groupName))
            .map((p) => ({ ...p, groupName: p.groupOrPosition ?? p.groupName })),
        );
      } catch (e) {
        setError(explainError(e).hint);
      }
    })();
  }, []);

  const greeting = useMemo(() => byHour(now.getHours()), [now]);
  const dateLabel = useMemo(() => formatDate(now), [now]);

  const runAnalysis = useCallback(async () => {
    if (!groups || !students) return;
    setAnalysisBusy(true);
    setError(null);
    setAnalysis(null);
    const debtorsByStudent = new Map<string, DebtorRow>();
    const absences: AbsenceRow[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 3600 * 1000);
    const todayIso = isoDate(today);

    try {
      let processed = 0;
      let totalSubjects = 0;
      // 1) Тянем семестры по каждой группе, считаем сколько предметов
      const subjectsToFetch: { gradebookId: number; subjectId: number; subjectName: string; groupName: string }[] = [];
      for (const g of groups) {
        const entries = await apiFetch<JournalEntry[]>(
          `/api/poozabeduapi/journal/groups/${g.externalId}/entries`,
        );
        const activeTerm = entries.find((e) => e.isActive) ?? entries[entries.length - 1];
        if (!activeTerm) continue;
        for (const subj of activeTerm.scheduleSubjects) {
          subjectsToFetch.push({
            gradebookId: activeTerm.id,
            subjectId: subj.id,
            subjectName: subj.name,
            groupName: g.name,
          });
        }
      }
      totalSubjects = subjectsToFetch.length;
      // 2) По каждому предмету тянем журнал и собираем двойки/отсутствия
      for (const t of subjectsToFetch) {
        processed++;
        setAnalysisProgress(`${processed} / ${totalSubjects} · ${t.subjectName.slice(0, 40)}`);
        try {
          const subj = await apiFetch<SubjectData>(
            `/api/poozabeduapi/journal/gradebooks/${t.gradebookId}/subjects/${t.subjectId}`,
          );
          const sIndex = new Map<number, SubjectStudent>();
          for (const s of subj.students) sIndex.set(s.id, s);

          for (const lesson of subj.lessons) {
            const lessonDate = lesson.date.slice(0, 10);
            const lessonDateObj = parseISO(lessonDate);
            if (!lessonDateObj) continue;
            const inWindow = lessonDateObj >= twoWeeksAgo && lessonDateObj <= today;
            const isToday = lessonDate === todayIso;

            const cells = lesson.markSets ?? {};
            for (const [studentIdStr, cell] of Object.entries(cells)) {
              const sid = Number(studentIdStr);
              const ssub = sIndex.get(sid);
              if (!ssub) continue;
              const studentName = `${ssub.lastName ?? ''} ${ssub.firstName ?? ''} ${ssub.middleName ?? ''}`.trim();

              // Двойки за окно 14 дней
              if (inWindow && cell.marks) {
                const hasTwo = Object.values(cell.marks).some((v) => isTwo(v));
                if (hasTwo) {
                  const key = `${t.groupName}/${studentName}`;
                  const row = debtorsByStudent.get(key) ?? {
                    studentName, groupName: t.groupName, twos: [],
                  };
                  row.twos.push({ subject: t.subjectName, date: lessonDate });
                  debtorsByStudent.set(key, row);
                }
              }

              // Отсутствие сегодня
              if (isToday && cell.absenceType) {
                absences.push({
                  studentName,
                  groupName: t.groupName,
                  status: classifyAbsence(cell.absenceType),
                  subject: t.subjectName,
                  raw: cell.absenceType,
                });
              }
            }
          }
        } catch {
          // одиночный сбой не валит весь анализ
        }
      }

      const debtors = Array.from(debtorsByStudent.values())
        .sort((a, b) => b.twos.length - a.twos.length);
      setAnalysis({ debtors, absences });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setAnalysisBusy(false);
      setAnalysisProgress('');
    }
  }, [groups, students]);

  return (
    <div className="col" style={{ gap: 'var(--s-7)' }}>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="row"
        style={{
          justifyContent: 'space-between', alignItems: 'flex-end',
          gap: 'var(--s-6)', borderBottom: '1px solid var(--ais-line)', paddingBottom: 'var(--s-6)',
        }}
      >
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            {dateLabel}
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(36px, 4vw, 52px)', lineHeight: 1.05 }}>
            <span className="muted">{greeting},</span>{' '}
            <span>{user?.firstName ?? '…'}</span>
          </h1>
        </div>
        <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
          <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            Закреплено групп
          </span>
          <span className="display tnum" style={{ fontSize: 'var(--fs-48)', lineHeight: 1 }}>
            {groups?.length ?? '—'}
          </span>
        </div>
      </motion.section>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {/* Карточки групп */}
      {groups && groups.length > 0 && (
        <section className="col" style={{ gap: 'var(--s-3)' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Мои группы</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--s-3)' }}>
            {groups.map((g) => {
              const inGroup = students?.filter((s) => s.groupExternalId === g.externalId) ?? [];
              return (
                <Link
                  key={g.externalId}
                  href="/my-group"
                  className="card col"
                  style={{ padding: 'var(--s-4)', gap: 'var(--s-2)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 'var(--fs-16)', fontWeight: 600 }}>{g.name}</span>
                    {g.yearNumber !== null && (
                      <span className="mono muted" style={{ fontSize: 11 }}>{g.yearNumber} курс</span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline' }}>
                    <span className="display tnum" style={{ fontSize: 'var(--fs-28)' }}>{inGroup.length}</span>
                    <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>{pluralizeStudents(inGroup.length)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Анализ за 2 недели — по кнопке, тяжёлая операция */}
      <section className="col" style={{ gap: 'var(--s-3)' }}>
        <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Успеваемость и посещаемость</h2>
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-12)', maxWidth: 600 }}>
              Сводка по группе за последние две недели: студенты с неудовлетворительными оценками
              и сегодняшние пропуски. Подготовка занимает до минуты.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void runAnalysis()}
            disabled={analysisBusy || !groups || !students}
          >
            <RefreshCw size={14} strokeWidth={1.75} className={analysisBusy ? 'spin' : ''} />
            {analysisBusy ? 'Анализируем…' : analysis ? 'Обновить' : 'Сформировать сводку'}
          </button>
        </header>
        {analysisBusy && (
          <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>Обрабатываем: {analysisProgress}</div>
        )}

        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--s-3)' }}>
            <DebtorsCard rows={analysis.debtors} />
            <AbsencesCard rows={analysis.absences} />
          </div>
        )}
      </section>

      {/* Новые заявки по моим студентам */}
      {(pendingCerts.length > 0 || pendingPasses.length > 0) && (
        <section className="col" style={{ gap: 'var(--s-3)' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Заявки по моим студентам</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--s-3)' }}>
            {pendingCerts.length > 0 && (
              <PendingRequestsCard
                title="Справки в работе"
                icon={<FileText size={18} strokeWidth={1.5} />}
                rows={pendingCerts}
                href="/certificates"
                rowHref={(r) => `/certificates/${r.id}`}
              />
            )}
            {pendingPasses.length > 0 && (
              <PendingRequestsCard
                title="Пропуска в работе"
                icon={<KeyRound size={18} strokeWidth={1.5} />}
                rows={pendingPasses}
                href="/passes"
                rowHref={(r) => `/passes/${r.id}`}
              />
            )}
          </div>
        </section>
      )}

      <section className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
        <Link href="/my-group" className="card col" style={cardLinkStyle}>
          <UsersRound size={20} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>Моя группа</span>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Список студентов и средние баллы</span>
        </Link>
        <Link href="/journal" className="card col" style={cardLinkStyle}>
          <BookOpen size={20} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>Журнал</span>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Оценки и посещаемость по предметам</span>
        </Link>
        <Link href="/schedule" className="card col" style={cardLinkStyle}>
          <CalendarDays size={20} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>Расписание</span>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Ваше расписание занятий и расписание группы</span>
        </Link>
      </section>

      <style jsx>{`
        :global(.spin) { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const cardLinkStyle: React.CSSProperties = {
  padding: 'var(--s-4)', gap: 'var(--s-2)', textDecoration: 'none', color: 'inherit',
  flex: '1 1 240px', minWidth: 240,
};

function PendingRequestsCard({
  title, icon, rows, href, rowHref,
}: {
  title: string;
  icon: React.ReactNode;
  rows: RequestRow[];
  href: string;
  rowHref: (r: RequestRow) => string;
}) {
  // Показываем максимум пять — остальное доступно по ссылке «Все заявки».
  const top = rows.slice(0, 5);
  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
          {icon}
          <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>{title}</span>
          <span className="badge badge--warn" style={{ fontSize: 11 }}>{rows.length}</span>
        </div>
        <Link href={href} className="link mono" style={{ fontSize: 11 }}>Все →</Link>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {top.map((r) => (
          <li key={r.id} style={{ padding: 'var(--s-2) 0', borderTop: '1px solid var(--ais-line)' }}>
            <Link href={rowHref(r)} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--s-3)' }}>
                <div className="col" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 'var(--fs-13)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.fullName}
                  </span>
                  <span className="mono muted" style={{ fontSize: 11 }}>
                    {r.groupName}
                    {r.certType ? ` · ${r.certType}` : ''}
                  </span>
                </div>
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {new Date(r.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DebtorsCard({ rows }: { rows: DebtorRow[] }) {
  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>
          <AlertTriangle size={14} strokeWidth={1.75} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--ais-ember)' }} />
          Неудовлетворительные оценки за две недели
        </span>
        <span className="mono muted">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>За последние две недели «двоек» не выставлено.</span>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          {rows.slice(0, 12).map((r, i) => (
            <li key={i} style={{ borderTop: i ? '1px solid var(--ais-line)' : 'none', paddingTop: i ? 'var(--s-2)' : 0 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--fs-13)', fontWeight: 500 }}>{r.studentName}</span>
                <span className="badge badge--bad">×{r.twos.length}</span>
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                {r.twos.slice(0, 3).map((t, j) => (
                  <span key={j}>{j ? ' · ' : ''}{t.subject} ({fmtDateRu(t.date)})</span>
                ))}
                {r.twos.length > 3 && <span> · и ещё {r.twos.length - 3}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AbsencesCard({ rows }: { rows: AbsenceRow[] }) {
  // Группируем по студенту
  const byStudent = new Map<string, AbsenceRow[]>();
  for (const r of rows) {
    const key = `${r.groupName}/${r.studentName}`;
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key)!.push(r);
  }
  const grouped = Array.from(byStudent.entries());

  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>
          <GraduationCap size={14} strokeWidth={1.75} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Сегодня отсутствуют
        </span>
        <span className="mono muted">{grouped.length}</span>
      </div>
      {grouped.length === 0 ? (
        <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>Все студенты на занятиях.</span>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          {grouped.slice(0, 16).map(([key, items], i) => {
            const worst = items.reduce<AbsenceRow>(
              (acc, x) => (priority(x.status) > priority(acc.status) ? x : acc),
              items[0],
            );
            return (
              <li key={key} style={{ borderTop: i ? '1px solid var(--ais-line)' : 'none', paddingTop: i ? 'var(--s-2)' : 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--fs-13)', fontWeight: 500 }}>{worst.studentName}</span>
                  <span className={`badge ${absenceBadgeClass(worst.status)}`} title={worst.raw}>
                    {absenceLabel(worst.status)}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{worst.groupName}{items.length > 1 && ` · ${items.length} ${pluralizeLessons(items.length)}`}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ────────── helpers ──────────

function isTwo(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'object' && 'value' in (v as object)) {
    const value = (v as { value: unknown }).value;
    if (typeof value === 'string') return TWO_VALUES.has(value);
    if (typeof value === 'number') return value <= 2;
  }
  if (typeof v === 'string') return TWO_VALUES.has(v);
  if (typeof v === 'number') return v <= 2;
  return false;
}

function classifyAbsence(t: string): AbsenceRow['status'] {
  if (SICK_TYPES.has(t)) return 'sick';
  if (LATE_TYPES.has(t)) return 'late';
  if (EXCUSED_TYPES.has(t)) return 'excused';
  if (ABSENT_TYPES.has(t)) return 'absent';
  return 'other';
}
function absenceLabel(s: AbsenceRow['status']): string {
  switch (s) {
    case 'sick': return 'Болеет';
    case 'late': return 'Опоздание';
    case 'excused': return 'УП';
    case 'absent': return 'НП';
    default: return '?';
  }
}
function absenceBadgeClass(s: AbsenceRow['status']): string {
  switch (s) {
    case 'sick': return 'badge--warn';
    case 'absent': return 'badge--bad';
    case 'excused': return 'badge--ok';
    case 'late': return 'badge--warn';
    default: return '';
  }
}
function priority(s: AbsenceRow['status']): number {
  return s === 'absent' ? 4 : s === 'sick' ? 3 : s === 'late' ? 2 : s === 'excused' ? 1 : 0;
}

function isoDate(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
function parseISO(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
function pluralizeStudents(n: number): string {
  const last = n % 10, lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'студентов';
  if (last === 1) return 'студент';
  if (last >= 2 && last <= 4) return 'студента';
  return 'студентов';
}
function pluralizeLessons(n: number): string {
  const last = n % 10, lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'занятий';
  if (last === 1) return 'занятие';
  if (last >= 2 && last <= 4) return 'занятия';
  return 'занятий';
}
function byHour(h: number): string {
  if (h < 5)  return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
function formatDate(d: Date): string {
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
