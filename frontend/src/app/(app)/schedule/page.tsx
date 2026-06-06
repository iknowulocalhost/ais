'use client';

import { useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/* ───── типы ответов API ───── */

interface DayGroupLesson { period: number; subject: string; teacher: string; room: string }
interface DayTeacherLesson { period: number; groupOrSubject: string; detail: string; room: string }
interface TodayGroupSection { kind: 'group'; groupName: string; lessons: DayGroupLesson[] }
interface TodayTeacherSection { kind: 'teacher'; teacherName: string; lessons: DayTeacherLesson[] }
interface TodayResponse {
  snapshot: { scheduleDate: string; fetchedAt: string };
  sections: Array<TodayGroupSection | TodayTeacherSection>;
}

interface WeekEntry {
  subjectOrGroup: string;
  teacherOrSubject: string;
  room: string;
  subgroup?: 1 | 2;
}
interface WeekSlot { period: number; entries: WeekEntry[] }
interface WeekDay { date: string; weekday: string; slots: WeekSlot[] }
interface WeekSection { target: string; kind: 'group' | 'teacher'; days: WeekDay[] }
interface WeekResponse { sections: WeekSection[] }

type Tab = 'today' | 'week';

export default function SchedulePage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'ADMINISTRATION', 'COM', 'TEA', 'STU']}>
      <ScheduleView />
    </Protected>
  );
}

function ScheduleView() {
  const { user, hasRole } = useAuth();
  const isStaff = hasRole(['SUPERADMIN', 'ADM', 'ADMINISTRATION', 'COM']);
  const isTeacher = !!user && user.roles.includes('TEA');
  const isStudent = !!user && user.roles.includes('STU');
  const hasPersonal = isStudent || isTeacher;
  const [tab, setTab] = useState<Tab>(hasPersonal ? 'today' : 'today');

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ais-bone-4)',
          }}
        >
          Учебный процесс
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
          Расписание и замены
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)', maxWidth: 640 }}>
          Актуальные пары и замены с сайта техникума. На сегодня — оперативные правки учебной части,
          на неделю — полная сетка пар.
        </p>
      </header>

      <div className="row" style={{ gap: 0, border: '1px solid var(--ais-line)', borderRadius: 8, padding: 2, alignSelf: 'flex-start' }}>
        <button
          type="button"
          onClick={() => setTab('today')}
          className={tab === 'today' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
        >
          На сегодня
        </button>
        <button
          type="button"
          onClick={() => setTab('week')}
          className={tab === 'week' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
        >
          На неделю
        </button>
      </div>

      {tab === 'today' && (
        <>
          {hasPersonal && <PersonalToday />}
          {isStaff && <StaffBrowseToday />}
        </>
      )}

      {tab === 'week' && (
        <>
          {hasPersonal && <PersonalWeek />}
          {isStaff && <StaffBrowseWeek />}
        </>
      )}
    </div>
  );
}

/* ════════ Персональная подборка — день ════════ */

function PersonalToday() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<TodayResponse>('/api/chtotib/today')
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => {
        if (!cancelled) setErrorText(e instanceof ApiError ? e.message : explainError(e).hint);
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);

  if (busy) return <SkeletonBlock />;
  if (errorText) return <ErrorBlock text={errorText} />;
  if (!data || data.sections.length === 0) {
    return (
      <section className="card" style={{ padding: 'var(--s-4)' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>
          Сегодня пар нет. Проверьте «На неделю», там видна полная сетка.
        </span>
      </section>
    );
  }

  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      <SnapshotHeader snapshot={data.snapshot} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--s-3)' }}>
        {data.sections.map((s, i) =>
          s.kind === 'group' ? (
            <GroupDayCard key={`g-${i}`} title={`Группа ${s.groupName}`} lessons={s.lessons} />
          ) : (
            <TeacherDayCard key={`t-${i}`} title={`Моё расписание · ${s.teacherName}`} lessons={s.lessons} />
          ),
        )}
      </div>
    </section>
  );
}

/* ════════ Персональная подборка — неделя ════════ */

function PersonalWeek() {
  const [data, setData] = useState<WeekResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<WeekResponse>('/api/chtotib/week')
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => {
        if (!cancelled) setErrorText(e instanceof ApiError ? e.message : explainError(e).hint);
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);

  if (busy) return <SkeletonBlock label="Загружаем недельную сетку…" />;
  if (errorText) return <ErrorBlock text={errorText} />;
  if (!data || data.sections.length === 0) {
    return (
      <section className="card" style={{ padding: 'var(--s-4)' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>
          Недельное расписание не найдено. Возможно, ваш аккаунт ещё не привязан к группе/преподавателю в Сетевом ПОО.
        </span>
      </section>
    );
  }

  return (
    <div className="col" style={{ gap: 'var(--s-4)' }}>
      {data.sections.map((s, i) => (
        <WeekGrid key={i} section={s} />
      ))}
    </div>
  );
}

/* ════════ Поиск любой группы/преподавателя для админов — день ════════ */

function StaffBrowseToday() {
  const [tab, setTab] = useState<'group' | 'teacher'>('group');
  const [groups, setGroups] = useState<string[] | null>(null);
  const [teachers, setTeachers] = useState<string[] | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [groupLessons, setGroupLessons] = useState<DayGroupLesson[] | null>(null);
  const [teacherLessons, setTeacherLessons] = useState<DayTeacherLesson[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TodayResponse['snapshot'] | null>(null);

  useEffect(() => {
    apiFetch<{ items: string[] }>('/api/chtotib/groups').then((r) => setGroups(r.items)).catch(() => setGroups([]));
    apiFetch<{ items: string[] }>('/api/chtotib/teachers').then((r) => setTeachers(r.items)).catch(() => setTeachers([]));
    apiFetch<TodayResponse['snapshot']>('/api/chtotib/snapshot').then(setSnapshot).catch(() => setSnapshot(null));
  }, []);

  async function loadGroup(name: string) {
    setBusy(true); setErrorText(null);
    try {
      const r = await apiFetch<{ lessons: DayGroupLesson[] }>('/api/chtotib/group', { query: { name } });
      setGroupLessons(r.lessons);
    } catch (e) { setErrorText(e instanceof ApiError ? e.message : explainError(e).hint); }
    finally { setBusy(false); }
  }

  async function loadTeacher(name: string) {
    setBusy(true); setErrorText(null);
    try {
      const r = await apiFetch<{ lessons: DayTeacherLesson[] }>('/api/chtotib/teacher', { query: { name } });
      setTeacherLessons(r.lessons);
    } catch (e) { setErrorText(e instanceof ApiError ? e.message : explainError(e).hint); }
    finally { setBusy(false); }
  }

  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      {snapshot && <SnapshotHeader snapshot={snapshot} />}
      <SubTabs value={tab} onChange={setTab} />
      {tab === 'group' ? (
        <PickerLine label="Группа" value={selectedGroup} items={groups} busy={busy}
          onChange={(v) => { setSelectedGroup(v); if (v) void loadGroup(v); }} />
      ) : (
        <PickerLine label="Преподаватель" value={selectedTeacher} items={teachers} busy={busy}
          onChange={(v) => { setSelectedTeacher(v); if (v) void loadTeacher(v); }} />
      )}
      {errorText && <ErrorBlock text={errorText} />}
      {tab === 'group' && selectedGroup && groupLessons && (
        <GroupDayCard title={`Группа ${selectedGroup}`} lessons={groupLessons} />
      )}
      {tab === 'teacher' && selectedTeacher && teacherLessons && (
        <TeacherDayCard title={selectedTeacher} lessons={teacherLessons} />
      )}
    </section>
  );
}

/* ════════ Поиск любой группы/преподавателя — неделя ════════ */

function StaffBrowseWeek() {
  const [tab, setTab] = useState<'group' | 'teacher'>('group');
  const [groups, setGroups] = useState<string[] | null>(null);
  const [teachers, setTeachers] = useState<string[] | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [week, setWeek] = useState<WeekSection | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: string[] }>('/api/chtotib/week/groups').then((r) => setGroups(r.items)).catch(() => setGroups([]));
    apiFetch<{ items: string[] }>('/api/chtotib/week/teachers').then((r) => setTeachers(r.items)).catch(() => setTeachers([]));
  }, []);

  async function loadGroup(name: string) {
    setBusy(true); setErrorText(null);
    try {
      const w = await apiFetch<WeekSection>('/api/chtotib/week/group', { query: { name } });
      setWeek(w);
    } catch (e) { setErrorText(e instanceof ApiError ? e.message : explainError(e).hint); }
    finally { setBusy(false); }
  }

  async function loadTeacher(name: string) {
    setBusy(true); setErrorText(null);
    try {
      const w = await apiFetch<WeekSection>('/api/chtotib/week/teacher', { query: { name } });
      setWeek(w);
    } catch (e) { setErrorText(e instanceof ApiError ? e.message : explainError(e).hint); }
    finally { setBusy(false); }
  }

  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      <SubTabs value={tab} onChange={(v) => { setTab(v); setWeek(null); }} />
      {tab === 'group' ? (
        <PickerLine label="Группа" value={selectedGroup} items={groups} busy={busy}
          onChange={(v) => { setSelectedGroup(v); setSelectedTeacher(''); if (v) void loadGroup(v); }} />
      ) : (
        <PickerLine label="Преподаватель" value={selectedTeacher} items={teachers} busy={busy}
          onChange={(v) => { setSelectedTeacher(v); setSelectedGroup(''); if (v) void loadTeacher(v); }} />
      )}
      {errorText && <ErrorBlock text={errorText} />}
      {week && <WeekGrid section={week} />}
    </section>
  );
}

/* ════════ presentational ════════ */

function SnapshotHeader({ snapshot }: { snapshot: TodayResponse['snapshot'] }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
        Замены и расписание на сегодня
      </span>
      <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
        Источник: <span className="mono">chtotib-it.github.io</span>
        {snapshot.scheduleDate && <> · на дату <b>{snapshot.scheduleDate}</b></>}
      </span>
    </div>
  );
}

function SubTabs({ value, onChange }: { value: 'group' | 'teacher'; onChange: (v: 'group' | 'teacher') => void }) {
  return (
    <div className="row" style={{ gap: 0, border: '1px solid var(--ais-line)', borderRadius: 8, padding: 2, alignSelf: 'flex-start' }}>
      <button type="button" onClick={() => onChange('group')} className={value === 'group' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}>
        По группе
      </button>
      <button type="button" onClick={() => onChange('teacher')} className={value === 'teacher' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}>
        По преподавателю
      </button>
    </div>
  );
}

function PickerLine({
  label, value, items, busy, onChange,
}: {
  label: string;
  value: string;
  items: string[] | null;
  busy: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
      <label className="col" style={{ gap: 4, minWidth: 260 }}>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>{label}</span>
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {items?.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      {busy && <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>Загрузка…</span>}
    </div>
  );
}

function GroupDayCard({ title, lessons }: { title: string; lessons: DayGroupLesson[] }) {
  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>{title}</span>
      {lessons.length === 0
        ? <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>На сегодня записей нет.</span>
        : <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          {lessons.map((l, i) => (
            <li key={i} className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline', borderTop: i === 0 ? 'none' : '1px solid var(--ais-line)', paddingTop: i === 0 ? 0 : 'var(--s-2)' }}>
              <span className="mono tnum" style={{ fontSize: 'var(--fs-14)', fontWeight: 600, minWidth: 24 }}>{l.period}</span>
              <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 'var(--fs-14)' }}>{l.subject}</span>
                <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                  {l.teacher || '—'}{l.room && <> · каб. <span className="mono">{l.room}</span></>}
                </span>
              </div>
            </li>
          ))}
        </ul>}
    </div>
  );
}

function TeacherDayCard({ title, lessons }: { title: string; lessons: DayTeacherLesson[] }) {
  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>{title}</span>
      {lessons.length === 0
        ? <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>На сегодня записей нет.</span>
        : <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          {lessons.map((l, i) => (
            <li key={i} className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline', borderTop: i === 0 ? 'none' : '1px solid var(--ais-line)', paddingTop: i === 0 ? 0 : 'var(--s-2)' }}>
              <span className="mono tnum" style={{ fontSize: 'var(--fs-14)', fontWeight: 600, minWidth: 24 }}>{l.period}</span>
              <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 'var(--fs-14)' }}>{l.groupOrSubject}</span>
                <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                  {l.detail || '—'}{l.room && <> · каб. <span className="mono">{l.room}</span></>}
                </span>
              </div>
            </li>
          ))}
        </ul>}
    </div>
  );
}

function WeekGrid({ section }: { section: WeekSection }) {
  const title = section.kind === 'group'
    ? `Группа ${section.target}`
    : `Преподаватель ${section.target}`;
  const days = section.days.filter((d) => d.slots.length > 0);
  if (days.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--s-4)' }}>
        <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>{title}</span>
        <div className="muted" style={{ fontSize: 'var(--fs-13)', marginTop: 'var(--s-2)' }}>
          На текущей неделе пар не запланировано.
        </div>
      </div>
    );
  }

  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--fs-16)', fontWeight: 600 }}>{title}</span>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          {days[0].date} — {days[days.length - 1].date}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--s-3)' }}>
        {days.map((d, i) => (
          <DayCard key={i} day={d} kind={section.kind} />
        ))}
      </div>
    </section>
  );
}

function DayCard({ day, kind }: { day: WeekDay; kind: 'group' | 'teacher' }) {
  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600 }}>{day.weekday}</span>
        <span className="mono muted" style={{ fontSize: 'var(--fs-12)' }}>{day.date}</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
        {day.slots.map((slot, i) => (
          <li key={i} className="row" style={{
            gap: 'var(--s-3)', alignItems: 'flex-start',
            borderTop: i === 0 ? 'none' : '1px solid var(--ais-line)',
            paddingTop: i === 0 ? 0 : 'var(--s-2)',
          }}>
            <span className="mono tnum" style={{ fontSize: 'var(--fs-14)', fontWeight: 600, minWidth: 24, marginTop: 2 }}>
              {slot.period}
            </span>
            <div className="col" style={{ gap: 'var(--s-2)', flex: 1, minWidth: 0 }}>
              {slot.entries.map((e, j) => (
                <div key={j} className="col" style={{ gap: 2 }}>
                  <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 'var(--fs-14)' }}>{e.subjectOrGroup}</span>
                    {e.subgroup && (
                      <span className="mono muted" style={{ fontSize: 11 }}>п/гр {e.subgroup}</span>
                    )}
                  </div>
                  <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                    {kind === 'group'
                      ? <>{e.teacherOrSubject || '—'}</>
                      : <>{e.teacherOrSubject || '—'}</>}
                    {e.room && <> · каб. <span className="mono">{e.room}</span></>}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonBlock({ label = 'Загружаем расписание…' }: { label?: string }) {
  return (
    <section className="card" style={{ padding: 'var(--s-4)' }}>
      <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>{label}</span>
    </section>
  );
}

function ErrorBlock({ text }: { text: string }) {
  return (
    <div className="callout callout--danger">
      <span>{text}</span>
    </div>
  );
}
