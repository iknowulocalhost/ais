'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, GraduationCap, RefreshCw } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * Журнал из Сетевого ПОО (read-only прокси).
 *
 * Drill-down: группы → семестры группы → предмет → таблица оценок и пропусков.
 * Никаких сохранений на нашей стороне — каждый клик уходит в upstream.
 */

interface JournalGroup {
  id: number;
  name: string;
  code?: string;
  yearNumber?: number;
}

interface ScheduleSubject {
  id: number;
  name: string;
  plannedHours?: number;
}

interface JournalEntry {
  id: number;                 // gradebookId
  name: string;
  yearNumber: number;
  termNumber: number;
  termType: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  scheduleSubjects: ScheduleSubject[];
}

interface SubjectLesson {
  id: number;
  date: string;
  type: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  tasks?: Array<{ id: number; type?: string; topic?: string; condition?: string }>;
  markSets?: Record<string, {
    absenceType?: string;
    marks?: Record<string, unknown>;
  }>;
}

interface SubjectStudent {
  id: number;
  number?: number;
  averageScore?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}

interface SubjectData {
  workingProgram?: { isApproved?: boolean; topics?: unknown[] };
  lessons: SubjectLesson[];
  students: SubjectStudent[];
  teacher?: string;
}

const ABSENCE_LABELS: Record<string, string> = {
  IsAbsentByValidReason: 'УП',     // уважительная причина
  IsAbsentByNotValidReason: 'Н',   // неуважительная
  IsLate: 'О',                     // опоздание
  IsAbsent: 'Н',
  Sick: 'Б',                       // болеет
  IsSick: 'Б',
  SickLeave: 'Б',                  // больничный (фактический enum IRTech)
  Sickness: 'Б',
  Excused: 'осв',                  // освобождён
};

/**
 * IRTech-овский enum значений оценок. Приходит на месте `marks[taskId].value`.
 * Маппим обратно к привычным «5/4/3/…»; неизвестные значения отдаём как есть.
 */
const MARK_VALUE_LABELS: Record<string, string> = {
  Five: '5',
  Four: '4',
  Three: '3',
  Two: '2',
  One: '1',
  Zero: '0',
  Excellent: '5',                  // на всякий случай — встречаются альтернативные имена
  Good: '4',
  Satisfactory: '3',
  Unsatisfactory: '2',
  Excused: 'осв',
  Absent: 'н',
  None: '',
};

function formatMarkValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  // Стандартный формат IRTech: { isRequired: bool, value: "Five" }
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const v = (raw as { value: unknown }).value;
    if (typeof v === 'string') return MARK_VALUE_LABELS[v] ?? v;
    if (v === null || v === undefined) return '';
    return String(v);
  }
  if (typeof raw === 'string') return MARK_VALUE_LABELS[raw] ?? raw;
  if (typeof raw === 'number') return String(raw);
  return '';
}

export default function JournalPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA']}>
      <JournalView />
    </Protected>
  );
}

function JournalView() {
  const [groups, setGroups] = useState<JournalGroup[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<{
    gradebookId: number;
    subjectId: number;
    subjectName: string;
    data: SubjectData | null;
  } | null>(null);

  // 1) Группы
  useEffect(() => {
    setBusy('groups');
    apiFetch<JournalGroup[]>('/api/poozabeduapi/journal/groups')
      .then((g) => { setGroups(g); setError(null); })
      .catch((e) => setError(explainError(e).hint))
      .finally(() => setBusy(null));
  }, []);

  // 2) Семестры группы
  const loadEntries = useCallback(async (gid: number) => {
    setBusy('entries');
    setError(null);
    try {
      const e = await apiFetch<JournalEntry[]>(`/api/poozabeduapi/journal/groups/${gid}/entries`);
      setEntries(e);
    } catch (err) {
      setError(explainError(err).hint);
      setEntries(null);
    } finally {
      setBusy(null);
    }
  }, []);

  function pickGroup(g: JournalGroup) {
    setGroupId(g.id);
    setEntries(null);
    setSubject(null);
    void loadEntries(g.id);
  }

  // 3) Предмет
  async function pickSubject(gradebookId: number, subj: ScheduleSubject) {
    setSubject({ gradebookId, subjectId: subj.id, subjectName: subj.name, data: null });
    setBusy('subject');
    setError(null);
    try {
      const data = await apiFetch<SubjectData>(
        `/api/poozabeduapi/journal/gradebooks/${gradebookId}/subjects/${subj.id}`,
      );
      setSubject({ gradebookId, subjectId: subj.id, subjectName: subj.name, data });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : explainError(err).hint);
      setSubject({ gradebookId, subjectId: subj.id, subjectName: subj.name, data: null });
    } finally {
      setBusy(null);
    }
  }

  const groupsByYear = useMemo(() => {
    if (!groups) return [];
    return [...groups].sort((a, b) => {
      const yA = a.yearNumber ?? 99;
      const yB = b.yearNumber ?? 99;
      if (yA !== yB) return yA - yB;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [groups]);

  // ────────── render ──────────

  if (subject) {
    return (
      <SubjectView
        subjectName={subject.subjectName}
        data={subject.data}
        busy={busy === 'subject'}
        error={error}
        onBack={() => { setSubject(null); setError(null); }}
      />
    );
  }

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          Преподаватели
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
          Электронный журнал
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)', maxWidth: 600 }}>
          Выберите группу, затем семестр и предмет. В таблице отобразятся оценки и пропуски за все
          проведённые занятия.
        </p>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--s-4)', alignItems: 'start' }}>
        {/* колонка 1: группы */}
        <div className="card col" style={{ padding: 'var(--s-3)', gap: 'var(--s-1)', maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="mono muted" style={{ fontSize: 11, padding: '0 var(--s-2) 4px' }}>
            Группы {groups && `(${groups.length})`}
          </div>
          {!groups && busy === 'groups' && <div className="muted" style={{ padding: 'var(--s-3)' }}>Загрузка…</div>}
          {groupsByYear.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pickGroup(g)}
              className={groupId === g.id ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
              style={{ justifyContent: 'space-between', textAlign: 'left' }}
            >
              <span>{g.name}</span>
              {g.yearNumber !== undefined && (
                <span className="mono" style={{ opacity: 0.6, fontSize: 11 }}>{g.yearNumber} курс</span>
              )}
            </button>
          ))}
        </div>

        {/* колонка 2: семестры + предметы */}
        <div className="col" style={{ gap: 'var(--s-3)' }}>
          {!groupId && (
            <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
              <BookOpen size={36} strokeWidth={1.5} />
              <span style={{ fontSize: 'var(--fs-14)' }}>Выберите группу слева</span>
            </div>
          )}
          {busy === 'entries' && <div className="muted">Загрузка журнала…</div>}
          {entries && entries.length === 0 && <div className="muted">У группы нет открытых журналов.</div>}
          {entries && entries.map((e) => (
            <div key={e.id} className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
                <div className="col" style={{ gap: 4 }}>
                  <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>
                    {e.name} · {e.yearNumber} курс · {e.termNumber} семестр
                  </h2>
                  <span className="mono muted" style={{ fontSize: 'var(--fs-12)' }}>
                    {fmt(e.startDate)} — {fmt(e.endDate)}
                    {!e.isActive && ' · закрыт'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--s-2)' }}>
                {e.scheduleSubjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSubject(e.id, s)}
                    className="btn btn--ghost btn--sm"
                    style={{ justifyContent: 'space-between', textAlign: 'left', whiteSpace: 'normal', height: 'auto', padding: '8px 12px' }}
                  >
                    <span style={{ flex: 1, fontSize: 'var(--fs-13)' }}>{s.name}</span>
                    {s.plannedHours !== undefined && (
                      <span className="mono muted" style={{ fontSize: 11, marginLeft: 8 }}>{s.plannedHours} ч</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────── представление одного предмета ───────

function SubjectView({
  subjectName, data, busy, error, onBack,
}: {
  subjectName: string;
  data: SubjectData | null;
  busy: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <button onClick={onBack} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
          <ChevronLeft size={14} strokeWidth={1.75} /> Вернуться к списку предметов
        </button>
        <h1 className="display" style={{ fontSize: 'clamp(22px, 2.4vw, 32px)', margin: 0, lineHeight: 1.2 }}>
          {subjectName}
        </h1>
        {data?.teacher && (
          <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>Преподаватель: {data.teacher}</span>
        )}
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}
      {busy && <div className="muted"><RefreshCw size={14} strokeWidth={1.75} /> Загружаем журнал…</div>}

      {data && <SubjectGrid data={data} />}
    </div>
  );
}

function SubjectGrid({ data }: { data: SubjectData }) {
  const sortedLessons = useMemo(
    () => [...data.lessons].sort((a, b) => a.date.localeCompare(b.date)),
    [data.lessons],
  );
  const sortedStudents = useMemo(
    () => [...data.students].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [data.students],
  );

  if (sortedStudents.length === 0) {
    return <div className="muted">В журнале нет учеников</div>;
  }
  if (sortedLessons.length === 0) {
    return <div className="muted">По предмету ещё не было занятий</div>;
  }

  return (
    <div className="card card--bleed" style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: 'var(--ais-paper)', zIndex: 1, minWidth: 240 }}>
              ФИО
            </th>
            {sortedLessons.map((l) => (
              <th key={l.id} style={{ minWidth: 56, textAlign: 'center' }}>
                <div className="col" style={{ gap: 0 }}>
                  <span className="mono" style={{ fontSize: 11 }}>{fmt(l.date)}</span>
                  <span className="mono muted" style={{ fontSize: 10 }}>{lessonTypeShort(l.type)}</span>
                </div>
              </th>
            ))}
            <th style={{ minWidth: 64, textAlign: 'center' }}>Ср. балл</th>
          </tr>
        </thead>
        <tbody>
          {sortedStudents.map((s) => {
            const fullName = `${s.lastName ?? ''} ${s.firstName ?? ''} ${s.middleName ?? ''}`.trim();
            return (
              <tr key={s.id}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--ais-paper)' }}>
                  <span className="mono muted" style={{ fontSize: 11, marginRight: 6 }}>
                    {s.number ?? '·'}
                  </span>
                  {fullName}
                </td>
                {sortedLessons.map((l) => {
                  const cell = l.markSets?.[String(s.id)];
                  return (
                    <td key={l.id} style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <CellValue cell={cell} />
                    </td>
                  );
                })}
                <td className="mono tnum" style={{ textAlign: 'center' }}>
                  {s.averageScore !== undefined ? s.averageScore.toFixed(2) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type MarkCell = { absenceType?: string; marks?: Record<string, unknown> } | undefined;

function CellValue({ cell }: { cell: MarkCell }) {
  if (!cell) return <span className="muted">·</span>;
  // Преобразуем оценки в человеческий вид. У одного урока может быть несколько
  // оценок (за разные задания) — пишем подряд.
  const markStrings = Object.values(cell.marks ?? {})
    .map(formatMarkValue)
    .filter((s) => s !== '');
  if (markStrings.length > 0) {
    return (
      <span className="mono" style={{ fontWeight: 600 }}>
        {markStrings.map((s, i) => (
          <span key={i} style={{ marginRight: i < markStrings.length - 1 ? 3 : 0 }}>
            {s}
          </span>
        ))}
      </span>
    );
  }
  if (cell.absenceType) {
    const label = ABSENCE_LABELS[cell.absenceType] ?? cell.absenceType.slice(0, 2);
    return <span className="mono" style={{ color: 'var(--ais-ember)' }} title={cell.absenceType}>
      {label}
    </span>;
  }
  return <span className="muted">·</span>;
}

function fmt(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function lessonTypeShort(t: string): string {
  switch (t) {
    case 'Lecture': return 'лек';
    case 'PracticalWork': return 'пр';
    case 'PracticalTraining': return 'тр';
    case 'Examination': return 'экз';
    default: return t.slice(0, 3).toLowerCase();
  }
}
