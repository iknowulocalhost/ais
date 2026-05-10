'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Protected } from '@/components/protected';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * Расписание группы из Сетевого ПОО.
 *
 * Формат ответа upstream (наблюдается на инсталляции poo.zabedu.ru):
 *   {
 *     item: { id: <planId>, name: "ИСиП-22-1п" },
 *     days: [
 *       { date: "2026-05-04T00:00:00...", lessons: [...], isHoliday: bool, isShort: bool },
 *       ...
 *     ]
 *   }
 *
 * Сервер сам бьёт неделю по дням — нам остаётся отрисовать. Структура одного
 * `lesson` пока не зафиксирована (на тестовой неделе у группы 4-го курса все
 * `lessons:[]` — учёба закончилась). Для полей урока используем мягкие типы
 * с возможными именами свойств; при первой непустой неделе уточним.
 */

interface MirrorGroup {
  externalId: number;
  name: string;
  yearNumber: number | null;
  isActive: boolean;
}

interface ScheduleLesson {
  id?: number;
  number?: number;            // номер пары
  startTime?: string;
  endTime?: string;
  type?: string;
  subject?: { id?: number; name?: string } | string;
  subjectName?: string;
  teacher?: { id?: number; name?: string } | string;
  teacherName?: string;
  classroom?: { id?: number; name?: string } | string;
  classroomName?: string;
  [key: string]: unknown;
}

interface ScheduleDay {
  date: string;
  lessons: ScheduleLesson[];
  isHoliday: boolean;
  isShort: boolean;
}

interface ScheduleResponse {
  item?: { id: number; name: string };
  days?: ScheduleDay[];
}

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  return r;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoDate(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
function fmtRu(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SchedulePage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA']}>
      <ScheduleView />
    </Protected>
  );
}

interface PlanCandidate {
  id: number;
  startDate?: string;
  endDate?: string;
  yearNumber?: number;
  termNumber?: number;
  name?: string;
  isActive?: boolean;
  raw: Record<string, unknown>;
}

type ViewMode = 'group' | 'teacher';

function ScheduleView() {
  const { user } = useAuth();
  const teacherEmployeeId = user?.netschoolEmployeeId ?? null;

  // По умолчанию TEA-учителю с привязкой показываем его расписание; всем остальным —
  // выбор группы. STAFF может вручную переключиться на «teacher», указав id.
  const [mode, setMode] = useState<ViewMode>('group');
  const [groups, setGroups] = useState<MirrorGroup[] | null>(null);
  const [groupExternalId, setGroupExternalId] = useState<number | ''>('');
  const [planId, setPlanId] = useState<number | null>(null);
  const [planEntries, setPlanEntries] = useState<unknown>(null);
  const [planCandidates, setPlanCandidates] = useState<PlanCandidate[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [timetable, setTimetable] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Группы из зеркала + автовыбор для TEA: если есть привязка — стартуем сразу с
  // его teacher-расписания, что чаще нужно классруку.
  useEffect(() => {
    apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups')
      .then((g) => {
        const active = g.filter((x) => x.isActive);
        setGroups(active);
        if (
          teacherEmployeeId !== null &&
          user &&
          !user.roles.includes('SUPERADMIN') &&
          !user.roles.includes('ADM') &&
          !user.roles.includes('COM')
        ) {
          setMode('teacher');
        }
      })
      .catch((e) => setError(explainError(e).hint));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherEmployeeId, user?.id]);

  // Когда выбрали группу — тянем планы расписания
  useEffect(() => {
    if (mode !== 'group' || !groupExternalId) {
      setPlanId(null); setPlanEntries(null); setPlanCandidates([]);
      return;
    }
    setBusy('plans');
    setError(null);
    apiFetch<unknown>(`/api/poozabeduapi/schedule/groups/${groupExternalId}/entries`)
      .then((e) => {
        setPlanEntries(e);
        const cand = extractPlanCandidates(e);
        setPlanCandidates(cand);
        const picked = pickPlanForDate(cand, weekStart) ?? cand[cand.length - 1] ?? null;
        setPlanId(picked?.id ?? null);
      })
      .catch((err) => setError(explainError(err).hint))
      .finally(() => setBusy(null));
  }, [mode, groupExternalId, weekStart]);

  // Сетка
  const loadTimetable = useCallback(async () => {
    setBusy('timetable');
    setError(null);
    try {
      const from = isoDate(weekStart);
      const to = isoDate(addDays(weekStart, 6));
      let t: ScheduleResponse | null = null;
      if (mode === 'teacher') {
        if (!teacherEmployeeId) {
          setTimetable(null);
          return;
        }
        t = await apiFetch<ScheduleResponse>('/api/poozabeduapi/schedule/timetable', {
          query: { from, to, type: 'teacher', id: teacherEmployeeId },
        });
      } else {
        if (!planId) { setTimetable(null); return; }
        t = await apiFetch<ScheduleResponse>('/api/poozabeduapi/schedule/timetable', {
          query: { from, to, type: 'studentGroup', id: planId },
        });
      }
      setTimetable(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : explainError(err).hint);
      setTimetable(null);
    } finally {
      setBusy(null);
    }
  }, [mode, planId, weekStart, teacherEmployeeId]);

  useEffect(() => { void loadTimetable(); }, [loadTimetable]);

  /**
   * Дни приходят в порядке ответа сервера, но мы привязываем их к колонкам Пн–Вс
   * по индексу даты относительно начала недели. Это устойчиво даже если сервер
   * вернёт «короткую» неделю (5 дней), праздники или неполный диапазон.
   */
  const daysByIndex = useMemo<(ScheduleDay | null)[]>(() => {
    const arr: (ScheduleDay | null)[] = [null, null, null, null, null, null, null];
    if (!timetable?.days) return arr;
    for (const day of timetable.days) {
      const d = new Date(day.date);
      if (Number.isNaN(d.getTime())) continue;
      const idx = Math.floor((startOfWeek(d).getTime() - weekStart.getTime()) / (24 * 3600 * 1000)) +
        ((d.getDay() + 6) % 7);
      // упрощённо: индекс — это дни от понедельника текущей недели
      const offset = Math.floor(
        (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - weekStart.getTime()) /
        (24 * 3600 * 1000),
      );
      if (offset >= 0 && offset < 7) arr[offset] = day;
      else void idx; // unused fallback
    }
    return arr;
  }, [timetable, weekStart]);

  const totalLessons = useMemo(
    () => daysByIndex.reduce((acc, d) => acc + (d?.lessons.length ?? 0), 0),
    [daysByIndex],
  );

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          Преподаватели
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
          Расписание занятий
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)', maxWidth: 600 }}>
          Просмотр недельной сетки занятий — по преподавателю или по группе.
        </p>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        {teacherEmployeeId !== null && (
          <div className="row" style={{ gap: 0, border: '1px solid var(--ais-line)', borderRadius: 8, padding: 2 }}>
            <button
              type="button"
              onClick={() => setMode('teacher')}
              className={mode === 'teacher' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
            >
              Моё расписание
            </button>
            <button
              type="button"
              onClick={() => setMode('group')}
              className={mode === 'group' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
            >
              Расписание группы
            </button>
          </div>
        )}

        {mode === 'group' && (
          <select
            className="input"
            value={groupExternalId}
            onChange={(e) => setGroupExternalId(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ minWidth: 240 }}
          >
            <option value="">— Выберите группу —</option>
            {groups
              ?.slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
              .map((g) => (
                <option key={g.externalId} value={g.externalId}>
                  {g.name}{g.yearNumber !== null ? ` · ${g.yearNumber} к.` : ''}
                </option>
              ))}
          </select>
        )}

        {(mode === 'teacher' || groupExternalId !== '') && (
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center', marginLeft: 'auto' }}>
            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setWeekStart(addDays(weekStart, -7))} title="Прошлая неделя">
              <ChevronLeft size={14} strokeWidth={1.75} />
            </button>
            <span className="mono" style={{ fontSize: 'var(--fs-13)', minWidth: 140, textAlign: 'center' }}>
              {fmtRu(weekStart)} — {fmtRu(addDays(weekStart, 6))}
            </span>
            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setWeekStart(addDays(weekStart, 7))} title="Следующая неделя">
              <ChevronRight size={14} strokeWidth={1.75} />
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Сегодня
            </button>
          </div>
        )}
      </div>

      {mode === 'group' && !groupExternalId && (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
          <CalendarDays size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>Выберите группу</span>
        </div>
      )}

      {mode === 'group' && groupExternalId !== '' && busy === 'plans' && <div className="muted">Загружаем расписание…</div>}

      {/* Если у группы несколько учебных периодов с разными планами — показываем
          выбор семестра. Если один — переключатель не нужен. */}
      {mode === 'group' && groupExternalId !== '' && busy !== 'plans' && planCandidates.length > 1 && (
        <div className="card col" style={{ padding: 'var(--s-3)', gap: 'var(--s-2)' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-13)' }}>
            Учебный период
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
            {planCandidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={planId === p.id ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
              >
                {p.yearNumber || p.termNumber ? (
                  <span>
                    {p.yearNumber ? `${p.yearNumber} курс` : ''}
                    {p.termNumber ? `${p.yearNumber ? ', ' : ''}${p.termNumber} семестр` : ''}
                  </span>
                ) : <span>Семестр</span>}
                {(p.startDate || p.endDate) && (
                  <span className="mono muted" style={{ marginLeft: 6, fontSize: 11 }}>
                    {p.startDate ? fmtIsoToRu(p.startDate) : ''}–{p.endDate ? fmtIsoToRu(p.endDate) : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'group' && groupExternalId !== '' && !planId && busy !== 'plans' && (
        <div className="callout">
          <span>У группы пока нет утверждённого расписания на текущий период.</span>
        </div>
      )}

      {(mode === 'teacher' || planId) && (
        <>
          {busy === 'timetable' && <div className="muted">Загружаем расписание…</div>}
          {!busy && timetable && (
            <>
              {totalLessons === 0 && (
                <div className="callout">
                  <span>На этой неделе занятий не запланировано.</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--s-2)' }}>
                {WEEK_DAYS.map((label, i) => {
                  const d = addDays(weekStart, i);
                  const day = daysByIndex[i];
                  const isHoliday = day?.isHoliday ?? false;
                  return (
                    <div
                      key={label}
                      className="card col"
                      style={{
                        padding: 'var(--s-3)',
                        gap: 'var(--s-2)',
                        minHeight: 140,
                        background: isHoliday ? 'var(--ais-paper-2)' : undefined,
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--fs-13)' }}>{label}</span>
                        <span className="mono muted" style={{ fontSize: 11 }}>{fmtRu(d)}</span>
                      </div>
                      {isHoliday && (
                        <span className="badge" style={{ alignSelf: 'flex-start', fontSize: 10 }}>Выходной</span>
                      )}
                      {day?.isShort && !isHoliday && (
                        <span className="badge" style={{ alignSelf: 'flex-start', fontSize: 10 }}>Сокращённый день</span>
                      )}
                      {!day || day.lessons.length === 0 ? (
                        !isHoliday && <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>—</span>
                      ) : (
                        day.lessons.map((l, idx) => <LessonCell key={idx} l={l} />)
                      )}
                    </div>
                  );
                })}
              </div>

            </>
          )}
        </>
      )}
    </div>
  );
}

function LessonCell({ l }: { l: ScheduleLesson }) {
  const subject = typeof l.subject === 'string' ? l.subject : l.subject?.name ?? l.subjectName;
  const teacher = typeof l.teacher === 'string' ? l.teacher : l.teacher?.name ?? l.teacherName;
  const classroom = typeof l.classroom === 'string' ? l.classroom : l.classroom?.name ?? l.classroomName;
  return (
    <div style={{ borderLeft: '3px solid var(--ais-bone-3)', paddingLeft: 8 }}>
      {(l.startTime || l.endTime || l.number !== undefined) && (
        <div className="mono muted" style={{ fontSize: 11 }}>
          {l.number !== undefined && <>№{l.number}</>}
          {(l.startTime || l.endTime) && (
            <> · {l.startTime ?? '?'}–{l.endTime ?? '?'}</>
          )}
        </div>
      )}
      <div style={{ fontSize: 'var(--fs-13)', fontWeight: 500 }}>{subject ?? '—'}</div>
      {teacher && <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>{teacher}</div>}
      {classroom && <div className="mono muted" style={{ fontSize: 11 }}>ауд. {classroom}</div>}
    </div>
  );
}

function fmtIsoToRu(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** Извлекает массив кандидатов-планов из произвольной формы ответа. */
function extractPlanCandidates(payload: unknown): PlanCandidate[] {
  const rawArr: Record<string, unknown>[] = [];
  if (Array.isArray(payload)) {
    rawArr.push(...(payload as Record<string, unknown>[]));
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['entries', 'plans', 'items', 'data']) {
      const v = obj[key];
      if (Array.isArray(v)) {
        rawArr.push(...(v as Record<string, unknown>[]));
        break;
      }
    }
    // Возможно, ответ — это сам один объект-план.
    if (rawArr.length === 0 && typeof obj.id === 'number') rawArr.push(obj);
  }
  return rawArr
    .filter((r) => typeof r.id === 'number')
    .map((r) => ({
      id: r.id as number,
      startDate: typeof r.startDate === 'string' ? (r.startDate as string) : undefined,
      endDate: typeof r.endDate === 'string' ? (r.endDate as string) : undefined,
      yearNumber: typeof r.yearNumber === 'number' ? (r.yearNumber as number) : undefined,
      termNumber: typeof r.termNumber === 'number' ? (r.termNumber as number) : undefined,
      name: typeof r.name === 'string' ? (r.name as string) : undefined,
      isActive: typeof r.isActive === 'boolean' ? (r.isActive as boolean) : undefined,
      raw: r,
    }));
}

/** Подбирает план, чей период [startDate, endDate] покрывает заданную дату. */
function pickPlanForDate(plans: PlanCandidate[], date: Date): PlanCandidate | null {
  const t = date.getTime();
  for (const p of plans) {
    const s = p.startDate ? new Date(p.startDate).getTime() : -Infinity;
    const e = p.endDate ? new Date(p.endDate).getTime() : Infinity;
    if (t >= s && t <= e) return p;
  }
  return null;
}
