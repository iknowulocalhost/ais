'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen, CalendarDays, BarChart3, FileText, KeyRound, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import {
  readDashboardCache, writeDashboardCache, isDashboardCacheStale,
} from '@/lib/dashboard-cache';

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
  isActive: boolean;
}

interface ChtotibGroupLesson { period: number; subject: string; teacher: string; room: string }
interface ChtotibTeacherLesson { period: number; groupOrSubject: string; detail: string; room: string }
interface ChtotibTodayResponse {
  snapshot: { scheduleDate: string; fetchedAt: string };
  sections: Array<
    | { kind: 'group'; groupName: string; lessons: ChtotibGroupLesson[] }
    | { kind: 'teacher'; teacherName: string; lessons: ChtotibTeacherLesson[] }
  >;
}

interface GroupDebtRow {
  studentExternalId: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
  count: number;
  subjects: string[];
}
interface GroupDebtsResponse {
  groupExternalId: number;
  term: number;
  year: number;
  rows: GroupDebtRow[];
}

export function TeacherDashboard() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDateMono(now), [now]);
  const greeting = useMemo(() => byHour(now.getHours()), [now]);

  type Snapshot = {
    groups: MirrorGroup[];
    students: MirrorStudent[];
    today: ChtotibTodayResponse | null;
    debts: GroupDebtsResponse | null;
  };
  const cacheKey = `teacher-dashboard:${user?.id ?? 'anon'}`;
  const cached = useMemo(() => readDashboardCache<Snapshot>(cacheKey), [cacheKey]);

  const [groups, setGroups] = useState<MirrorGroup[]>(cached?.groups ?? []);
  const [students, setStudents] = useState<MirrorStudent[]>(cached?.students ?? []);
  const [today, setToday] = useState<ChtotibTodayResponse | null>(cached?.today ?? null);
  const [debts, setDebts] = useState<GroupDebtsResponse | null>(cached?.debts ?? null);
  const [scheduleTab, setScheduleTab] = useState<'mine' | 'group'>('mine');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(!!cached);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    if (cached && !isDashboardCacheStale(cacheKey)) return;
    setRefreshing(!!cached);
    (async () => {
      try {
        const gs = await apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups').catch(() => []);
        const active = (Array.isArray(gs) ? gs : []).filter((g) => g.isActive);
        let nextStudents = students;
        let nextToday = today;
        let nextDebts = debts;
        if (!cancelled) setGroups(active);
        const myGroup = active[0];
        await Promise.all([
          apiFetch<{ items: MirrorStudent[] }>('/api/poozabeduapi/mirror/students', {
            query: { isActive: 'true', limit: 500 },
          })
            .then((r) => { nextStudents = r.items; if (!cancelled) setStudents(r.items); })
            .catch(() => {}),
          apiFetch<ChtotibTodayResponse>('/api/chtotib/today')
            .then((d) => { nextToday = d; if (!cancelled) setToday(d); })
            .catch(() => {}),
          myGroup
            ? apiFetch<GroupDebtsResponse>(`/api/poozabeduapi/groups/${myGroup.externalId}/debts`)
                .then((d) => { nextDebts = d; if (!cancelled) setDebts(d); })
                .catch(() => {})
            : Promise.resolve(),
        ]);
        if (!cancelled) {
          writeDashboardCache<Snapshot>(cacheKey, {
            groups: active, students: nextStudents, today: nextToday, debts: nextDebts,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : explainError(e).hint);
      } finally {
        if (!cancelled) { setLoaded(true); setRefreshing(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const myGroup = groups[0] ?? null;
  const myGroupStudents = students.filter((s) => myGroup && s.groupExternalId === myGroup.externalId);

  const groupSchedule = (today?.sections.find((s) => s.kind === 'group') ?? null) as
    | { kind: 'group'; groupName: string; lessons: ChtotibGroupLesson[] }
    | null;
  const teacherSchedule = (today?.sections.find((s) => s.kind === 'teacher') ?? null) as
    | { kind: 'teacher'; teacherName: string; lessons: ChtotibTeacherLesson[] }
    | null;

  const activeLessons = scheduleTab === 'mine'
    ? (teacherSchedule?.lessons ?? [])
    : (groupSchedule?.lessons ?? []);

  const currentPeriod = computeCurrentPeriod(now);

  const debtsTotal = debts?.rows.reduce((acc, r) => acc + r.count, 0) ?? 0;
  const debtsStudents = debts?.rows.length ?? 0;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {/* ────────── HERO ────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42 }}
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--s-5)', flexWrap: 'wrap' }}
      >
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ais-bone-4)' }}>
              {dateLabel}
            </div>
            {refreshing && <RefreshDot title="Обновляем данные…" />}
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 4vw, 52px)', lineHeight: 1.05, margin: 0 }}>
            {greeting},{' '}
            <em style={{ color: 'var(--ais-forest)', fontStyle: 'italic', fontWeight: 600 }}>
              {user?.firstName ?? '…'}
            </em>.
          </h1>
          <div className="muted" style={{ fontSize: 'var(--fs-13)' }}>
            {myGroup
              ? <>Группа <b style={{ color: 'var(--ais-bone)' }}>{myGroup.name}</b>{myGroup.yearNumber !== null && ` · ${myGroup.yearNumber} курс`} · {myGroupStudents.length} {pluralize(myGroupStudents.length, ['студент', 'студента', 'студентов'])}</>
              : 'У вас пока нет закреплённой группы'}
          </div>
        </div>

        <div className="row" style={{ gap: 'var(--s-6)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <HeroCounter label="Студентов" value={String(myGroupStudents.length)} tone="bone" />
          <HeroCounter label="С долгами" value={String(debtsStudents)} tone={debtsStudents > 0 ? 'ember' : 'bone'} />
          <HeroCounter label="Пар сегодня" value={String(activeLessonsCount(today, scheduleTab))} tone="forest" />
        </div>
      </motion.section>

      {/* ────────── 3-COLUMN BODY ────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: 'var(--s-3)',
          alignItems: 'stretch',
        }}
        className="dashboard-grid"
      >
        {/* ── Левая: «Состав группы» ── */}
        <section className="card col" style={{ padding: 'var(--s-5)', gap: 'var(--s-4)', minHeight: 360 }}>
          <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ais-bone-3)' }}>
              Состав группы
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ais-bone-4)' }}>
              {myGroup?.name ?? '—'}
            </div>
          </header>

          {!loaded ? (
            <>
              <Skeleton width={120} height={56} />
              <div className="initials-grid" style={{ marginTop: 'var(--s-2)' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} height={32} radius="var(--r-6)" />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s-2)' }}>
                <span className="display tnum" style={{ fontSize: 'var(--fs-64)', lineHeight: 1, fontWeight: 600 }}>
                  {myGroupStudents.length}
                </span>
                <span className="display" style={{ fontStyle: 'italic', fontSize: 'var(--fs-15)', color: 'var(--ais-bone-3)' }}>
                  {pluralize(myGroupStudents.length, ['студент', 'студента', 'студентов'])}
                </span>
              </div>
              <div className="initials-grid">
                {myGroupStudents.map((s) => (
                  <span key={s.externalId} className="initial-chip" title={`${s.lastName} ${s.firstName}`}>
                    {(s.lastName[0] ?? '').toUpperCase()}{(s.firstName[0] ?? '').toUpperCase()}
                  </span>
                ))}
                {myGroupStudents.length === 0 && (
                  <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>Состав группы пуст.</span>
                )}
              </div>
            </>
          )}

          <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--ais-line)', paddingTop: 'var(--s-3)' }}>
            <Link
              href="/my-group"
              className="row mono"
              style={{
                gap: 6, alignItems: 'center', fontSize: 10,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--ais-bone-3)', textDecoration: 'none',
              }}
            >
              Перейти к досье группы
              <ArrowRight size={12} strokeWidth={1.75} />
            </Link>
          </footer>
        </section>

        {/* ── Центр: «Расписание · сегодня» ── */}
        <section className="card col" style={{ padding: 'var(--s-5)', gap: 'var(--s-4)', minHeight: 360 }}>
          <header className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ais-bone-3)' }}>
              Расписание · сегодня
            </div>
            <div className="row" style={{ gap: 0, border: '1px solid var(--ais-line)', borderRadius: 'var(--r-pill)', padding: 2 }}>
              <button
                type="button"
                onClick={() => setScheduleTab('mine')}
                className={scheduleTab === 'mine' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
                style={{ borderRadius: 'var(--r-pill)' }}
              >
                Моё
              </button>
              <button
                type="button"
                onClick={() => setScheduleTab('group')}
                className={scheduleTab === 'group' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
                style={{ borderRadius: 'var(--r-pill)' }}
              >
                Группы
              </button>
            </div>
          </header>

          {!loaded ? (
            <div className="col" style={{ gap: 'var(--s-3)', flex: 1 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
                  <Skeleton width={48} height={28} />
                  <Skeleton width={8} height={8} radius="50%" style={{ marginTop: 6 }} />
                  <div className="col" style={{ flex: 1, gap: 4 }}>
                    <Skeleton width="80%" height={16} />
                    <Skeleton width="40%" height={11} />
                  </div>
                </div>
              ))}
            </div>
          ) : activeLessons.length === 0 ? (
            <div className="muted" style={{ fontSize: 'var(--fs-13)', flex: 1 }}>
              {scheduleTab === 'mine' ? 'Сегодня у вас пар нет.' : 'У группы сегодня пар нет.'}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
              {activeLessons.map((l, i) => {
                const isCurrent = l.period === currentPeriod;
                const periodTimes = PERIOD_TIMES[l.period - 1] ?? ['—', '—'];
                if (scheduleTab === 'mine') {
                  const lt = l as ChtotibTeacherLesson;
                  return (
                    <LessonRow
                      key={`m-${i}`}
                      isCurrent={isCurrent}
                      times={periodTimes}
                      title={lt.groupOrSubject || '—'}
                      meta={`${lt.room ? `АУД. ${lt.room}` : 'без аудитории'} · ${lt.detail || '—'}`}
                    />
                  );
                }
                const lg = l as ChtotibGroupLesson;
                return (
                  <LessonRow
                    key={`g-${i}`}
                    isCurrent={isCurrent}
                    times={periodTimes}
                    title={lg.subject || '—'}
                    meta={`${lg.room ? `АУД. ${lg.room}` : 'без аудитории'} · ${groupSchedule?.groupName ?? ''}`}
                  />
                );
              })}
            </ul>
          )}

          <footer className="muted mono" style={{ borderTop: '1px solid var(--ais-line)', paddingTop: 'var(--s-3)', marginTop: 'auto', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {activeLessons.length} {pluralize(activeLessons.length, ['пара', 'пары', 'пар'])}
            {currentPeriod && activeLessons.some((l) => l.period === currentPeriod) && ` · идёт ${currentPeriod}-я`}
          </footer>
        </section>

        {/* ── Правая: «Долги студентов» ── */}
        <section className="card col" style={{ padding: 'var(--s-5)', gap: 'var(--s-3)', minHeight: 360 }}>
          <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ais-bone-3)' }}>
              Долги студентов
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ais-bone-4)' }}>
              {debtsTotal} всего
            </div>
          </header>

          {!loaded ? (
            <div className="col" style={{ gap: 'var(--s-3)', flex: 1 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
                  <Skeleton width={32} height={32} radius="var(--r-6)" />
                  <div className="col" style={{ flex: 1, gap: 4 }}>
                    <Skeleton width="60%" height={14} />
                    <Skeleton width="80%" height={11} />
                  </div>
                  <Skeleton width={20} height={24} />
                </div>
              ))}
            </div>
          ) : !debts || debts.rows.length === 0 ? (
            <div className="muted" style={{ fontSize: 'var(--fs-13)', flex: 1 }}>
              По текущему семестру несдач нет.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', flex: 1 }}>
              {debts.rows.slice(0, 6).map((r) => (
                <DebtRow key={r.studentExternalId} item={r} />
              ))}
            </ul>
          )}

          {debts && debts.rows.length > 6 && (
            <footer style={{ borderTop: '1px solid var(--ais-line)', paddingTop: 'var(--s-3)', marginTop: 'auto' }}>
              <Link
                href="/reports"
                className="row mono"
                style={{
                  gap: 6, alignItems: 'center', fontSize: 10,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--ais-bone-3)', textDecoration: 'none',
                }}
              >
                Ещё {debts.rows.length - 6} студентов · открыть ведомость
                <ArrowRight size={12} strokeWidth={1.75} />
              </Link>
            </footer>
          )}
        </section>
      </div>

      {/* ────────── QUICK ACTIONS ────────── */}
      <section
        className="quick-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 'var(--s-3)',
        }}
      >
        <QuickCard
          icon={<BookOpen size={18} strokeWidth={1.75} />}
          title="Журнал группы"
          subtitle="оценки · посещаемость"
          href="/journal"
          accent
        />
        <QuickCard
          icon={<CalendarDays size={18} strokeWidth={1.75} />}
          title="Расписание · неделя"
          subtitle="моё и группы"
          href="/schedule"
        />
        <QuickCard
          icon={<BarChart3 size={18} strokeWidth={1.75} />}
          title="Ведомости и отчёты"
          subtitle="формирование · экспорт"
          href="/reports"
        />
        <QuickCard
          icon={<FileText size={18} strokeWidth={1.75} />}
          title="Заказать справку"
          subtitle="для студента · для себя"
          href="/certificates"
        />
        <QuickCard
          icon={<KeyRound size={18} strokeWidth={1.75} />}
          title="Заказать пропуск"
          subtitle="болезнь · отгул"
          href="/passes"
        />
      </section>

      <DashboardGlobalAnims />
      <style jsx>{`
        :global(.dashboard-grid) { /* hook for media-queries below */ }
        @media (max-width: 1280px) {
          :global(.dashboard-grid) {
            grid-template-columns: 1fr 1fr !important;
          }
          :global(.dashboard-grid > section:nth-child(3)) {
            grid-column: 1 / span 2;
          }
        }
        @media (max-width: 900px) {
          :global(.dashboard-grid) { grid-template-columns: 1fr !important; }
          :global(.dashboard-grid > section:nth-child(3)) { grid-column: auto; }
          :global(.quick-row) { grid-template-columns: repeat(2, 1fr) !important; }
        }
        :global(.initials-grid) {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
          gap: var(--s-1);
        }
        :global(.initial-chip) {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 32px;
          border: 1px solid var(--ais-line);
          border-radius: var(--r-6);
          background: var(--ais-paper-2);
          font-family: var(--ais-font-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--ais-bone-2);
        }
        :global(.initial-chip .dot) {
          position: absolute;
          bottom: 3px;
          right: 4px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
        :global(.dot--ok) { background: var(--ais-forest); }
        :global(.dot--warn) { background: var(--ais-ochre); }
        :global(.dot--bad) { background: var(--ais-ember); }
      `}</style>
    </div>
  );
}

/* ────────── subcomponents ────────── */

function RefreshDot({ title }: { title?: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-block',
        width: 12, height: 12, borderRadius: '50%',
        border: '2px solid var(--ais-line)',
        borderTopColor: 'var(--ais-forest)',
        animation: 'aisSpin 0.9s linear infinite',
      }}
    />
  );
}

function Skeleton({
  width = '100%', height = 16, radius = 4, style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width, height, borderRadius: radius,
        background:
          'linear-gradient(90deg, var(--ais-paper-2) 0%, var(--ais-line) 50%, var(--ais-paper-2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'aisShimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function DashboardGlobalAnims() {
  return (
    <style jsx global>{`
      @keyframes aisSpin { to { transform: rotate(360deg); } }
      @keyframes aisShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}

function HeroCounter({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone: 'forest' | 'ochre' | 'ember' | 'bone';
}) {
  const color =
    tone === 'forest' ? 'var(--ais-forest)' :
    tone === 'ochre'  ? 'var(--ais-ochre)' :
    tone === 'ember'  ? 'var(--ais-ember)' :
    'var(--ais-bone)';
  return (
    <div className="col" style={{ gap: 4, minWidth: 64, alignItems: 'flex-start' }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ais-bone-4)' }}>
        {label}
      </span>
      <span className="display tnum" style={{ fontSize: 'var(--fs-36)', lineHeight: 1, color }}>
        {value}
      </span>
    </div>
  );
}

function LessonRow({
  isCurrent, times, title, meta,
}: {
  isCurrent: boolean;
  times: [string, string];
  title: string;
  meta: string;
}) {
  return (
    <li className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
      <div className="mono tnum" style={{ minWidth: 56, lineHeight: 1.4 }}>
        <div style={{ fontSize: 'var(--fs-13)', color: 'var(--ais-bone)' }}>{times[0]}</div>
        <div style={{ fontSize: 11, color: 'var(--ais-bone-4)' }}>{times[1]}</div>
      </div>
      <span
        aria-hidden
        style={{
          marginTop: 6,
          width: 8, height: 8, borderRadius: '50%',
          background: isCurrent ? 'var(--ais-forest)' : 'var(--ais-line-2)',
          flexShrink: 0,
        }}
      />
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--fs-15)',
          color: 'var(--ais-bone)',
          fontStyle: isCurrent ? 'italic' : 'normal',
          fontWeight: isCurrent ? 600 : 400,
        }}>
          {title}{isCurrent && <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: 'var(--ais-forest)', letterSpacing: '0.1em' }}>· ИДЁТ</span>}
        </div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ais-bone-3)' }}>
          {meta}
        </div>
      </div>
      <ArrowRight size={12} strokeWidth={1.75} style={{ color: 'var(--ais-bone-4)', marginTop: 6 }} />
    </li>
  );
}

function DebtRow({ item }: { item: GroupDebtRow }) {
  const initials = `${item.lastName[0] ?? ''}${item.firstName[0] ?? ''}`.toUpperCase();
  return (
    <Link
      href={`/dossier/${item.studentExternalId}`}
      className="row"
      style={{ gap: 'var(--s-3)', alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 'var(--r-6)',
        border: '1px solid var(--ais-line)', background: 'var(--ais-paper-2)',
        fontFamily: 'var(--ais-font-mono)', fontSize: 11, color: 'var(--ais-bone-3)',
        flexShrink: 0,
      }}>
        {initials}
      </span>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone)' }}>
          {item.lastName} {item.firstName}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>
          {item.subjects.length > 0 ? item.subjects.slice(0, 3).join(' · ') : '—'}
        </div>
      </div>
      <span className="display tnum" style={{ fontSize: 'var(--fs-22)', color: 'var(--ais-ember)', lineHeight: 1 }}>
        {item.count}
      </span>
      <ArrowRight size={12} strokeWidth={1.75} style={{ color: 'var(--ais-bone-4)', marginTop: 8 }} />
    </Link>
  );
}

function QuickCard({
  icon, title, subtitle, href, accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card row"
      style={{
        padding: 'var(--s-4)',
        gap: 'var(--s-3)',
        textDecoration: 'none',
        color: 'inherit',
        background: accent ? 'var(--ais-forest)' : undefined,
        borderColor: accent ? 'var(--ais-forest)' : undefined,
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 'var(--r-6)',
          background: accent ? 'rgba(255,255,255,0.18)' : 'var(--ais-paper-2)',
          border: accent ? 'none' : '1px solid var(--ais-line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent ? 'var(--ais-ivy-2)' : 'var(--ais-bone-2)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-14)', fontWeight: 600, color: accent ? 'var(--ais-ivy-2)' : 'var(--ais-bone)' }}>
          {title}
        </div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent ? 'rgba(20,38,30,0.7)' : 'var(--ais-bone-3)' }}>
          {subtitle}
        </div>
      </div>
      <ArrowRight size={14} strokeWidth={1.75} style={{ color: accent ? 'var(--ais-ivy-2)' : 'var(--ais-bone-4)', alignSelf: 'center' }} />
    </Link>
  );
}

/* ────────── helpers ────────── */

const PERIOD_TIMES: Array<[string, string]> = [
  ['08:30', '10:00'],
  ['10:10', '11:40'],
  ['11:50', '13:20'],
  ['14:00', '15:30'],
  ['15:40', '17:10'],
  ['17:20', '18:50'],
  ['19:00', '20:30'],
  ['20:40', '22:10'],
];

function activeLessonsCount(
  today: ChtotibTodayResponse | null,
  tab: 'mine' | 'group',
): number {
  if (!today) return 0;
  const sec = today.sections.find((s) => s.kind === (tab === 'mine' ? 'teacher' : 'group'));
  if (!sec) return 0;
  return (sec.lessons as unknown[]).length;
}

function computeCurrentPeriod(now: Date): number | null {
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < PERIOD_TIMES.length; i++) {
    const [s, e] = PERIOD_TIMES[i];
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    const a = sh * 60 + sm;
    const b = eh * 60 + em;
    if (mins >= a && mins <= b) return i + 1;
  }
  return null;
}

function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDateMono(d: Date): string {
  const days = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
  const months = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ','ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function byHour(h: number): string {
  if (h < 5)  return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const teen = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (teen > 1 && teen < 5) return forms[1];
  if (teen === 1) return forms[0];
  return forms[2];
}
