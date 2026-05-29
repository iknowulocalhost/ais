'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell, Plus, FileText, KeyRound, BookOpen, CalendarDays, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import {
  readDashboardCache, writeDashboardCache, isDashboardCacheStale,
} from '@/lib/dashboard-cache';

interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  studentExternalId: number | null;
}

interface ChtotibLesson { period: number; subject: string; teacher: string; room: string }
interface ChtotibTodayResponse {
  snapshot: { scheduleDate: string; fetchedAt: string };
  sections: Array<
    | { kind: 'group'; groupName: string; lessons: ChtotibLesson[] }
    | { kind: 'teacher'; teacherName: string; lessons: unknown[] }
  >;
}

interface TermStats {
  year: number;
  term: number;
  gpa: number | null;
  count: number;
  attendanceMissedAll: number;
  attendanceMissedInvalid: number;
  debtsCount: number;
  debtsSubjects: string[];
}
interface SemesterStatsResponse {
  gpa: number | null;
  gpaDelta: number | null;
  sampleSize: number;
  currentTerm: TermStats;
  previousTerm: TermStats;
  perTerm: TermStats[];
}

interface StudentDetail {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  studentGroup?: { id?: number; name?: string };
  gradePointAverage?: number;
}

interface CertRow {
  id: string;
  displayNo: number;
  certType: 'STUDY' | 'SCHOLARSHIP' | 'INCOME' | 'TAX' | 'MILITARY';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}
interface PassRow { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string }

const CERT_TYPE_LABEL: Record<CertRow['certType'], string> = {
  STUDY: 'Об обучении',
  SCHOLARSHIP: 'О стипендии',
  INCOME: 'О доходах',
  TAX: 'Налоговый вычет',
  MILITARY: 'В военкомат',
};

export function StudentDashboard() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDate(now), [now]);

  const cacheKey = `student-dashboard:${user?.id ?? 'anon'}`;
  type Snapshot = {
    student: StudentDetail | null;
    today: ChtotibTodayResponse | null;
    stats: SemesterStatsResponse | null;
    certs: CertRow[];
    passes: PassRow[];
  };
  const cached = useMemo(() => readDashboardCache<Snapshot>(cacheKey), [cacheKey]);

  const [student, setStudent] = useState<StudentDetail | null>(cached?.student ?? null);
  const [today, setToday] = useState<ChtotibTodayResponse | null>(cached?.today ?? null);
  const [stats, setStats] = useState<SemesterStatsResponse | null>(cached?.stats ?? null);
  const [certs, setCerts] = useState<CertRow[]>(cached?.certs ?? []);
  const [passes, setPasses] = useState<PassRow[]>(cached?.passes ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(!!cached);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    if (cached && !isDashboardCacheStale(cacheKey)) return;
    setRefreshing(!!cached);
    (async () => {
      try {
        const meResp = await apiFetch<MeResponse>('/api/users/me');
        let nextStudent: StudentDetail | null = student;
        let nextToday: ChtotibTodayResponse | null = today;
        let nextStats: SemesterStatsResponse | null = stats;
        let nextCerts: CertRow[] = certs;
        let nextPasses: PassRow[] = passes;
        await Promise.all([
          apiFetch<ChtotibTodayResponse>('/api/chtotib/today')
            .then((d) => { nextToday = d; if (!cancelled) setToday(d); })
            .catch(() => {}),
          apiFetch<{ items: CertRow[] }>('/api/certificates', { query: { status: 'PENDING', limit: 5 } })
            .then((r) => { nextCerts = r.items; if (!cancelled) setCerts(r.items); })
            .catch(() => {}),
          apiFetch<{ items: PassRow[] }>('/api/passes', { query: { status: 'PENDING', limit: 5 } })
            .then((r) => { nextPasses = r.items; if (!cancelled) setPasses(r.items); })
            .catch(() => {}),
          meResp.studentExternalId
            ? Promise.all([
                apiFetch<StudentDetail>(`/api/poozabeduapi/students/${meResp.studentExternalId}`)
                  .then((d) => { nextStudent = d; if (!cancelled) setStudent(d); })
                  .catch(() => {}),
                apiFetch<SemesterStatsResponse>(`/api/poozabeduapi/students/${meResp.studentExternalId}/college-gpa`)
                  .then((d) => { nextStats = d; if (!cancelled) setStats(d); })
                  .catch(() => {}),
              ])
            : Promise.resolve(),
        ]);
        if (!cancelled) {
          writeDashboardCache<Snapshot>(cacheKey, {
            student: nextStudent, today: nextToday, stats: nextStats,
            certs: nextCerts, passes: nextPasses,
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

  const todaySection = today?.sections.find((s) => s.kind === 'group') as
    | { kind: 'group'; groupName: string; lessons: ChtotibLesson[] }
    | undefined;
  const todayLessons = todaySection?.lessons ?? [];
  const totalApps = certs.length + passes.length;

  const gpa = stats?.gpa ?? null;
  const gpaDelta = stats?.gpaDelta ?? null;
  const attendance = computeAttendancePercent(stats?.currentTerm);
  const debts = stats?.currentTerm.debtsCount ?? 0;
  const debtsList = stats?.currentTerm.debtsSubjects ?? [];

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <DashboardGlobalAnims />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="bento-grid"
      >
        {/* ─── HERO ─── */}
        <BentoCard className="bento--hero" gridArea="hero">
          <div className="col" style={{ gap: 'var(--s-3)' }}>
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
              <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
                {dateLabel}
              </div>
              {refreshing && <RefreshDot title="Обновляем данные…" />}
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(32px, 4vw, 56px)', lineHeight: 1.05, margin: 0 }}>
              Привет, <span style={{ color: 'var(--ais-forest)' }}>{user?.firstName ?? '…'}</span>.
            </h1>
            {!loaded ? (
              <Skeleton width="60%" height={20} />
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--fs-15)', color: 'var(--ais-bone-2)' }}>
                {heroLine(todayLessons.length, totalApps, student?.studentGroup?.name)}
              </p>
            )}
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', marginTop: 'auto' }}>
            <button type="button" className="btn btn--outline btn--icon" aria-label="Уведомления">
              <Bell size={16} strokeWidth={1.75} />
            </button>
            <Link href="/certificates" className="btn btn--primary">
              <Plus size={16} strokeWidth={2} />
              Заказать справку
            </Link>
          </div>
        </BentoCard>

        {/* ─── GPA ─── */}
        <BentoCard gridArea="gpa" label="GPA · семестр">
          {!loaded && !stats ? (
            <>
              <Skeleton width="60%" height={56} />
              <Skeleton width="40%" height={12} style={{ marginTop: 'var(--s-2)' }} />
            </>
          ) : (
            <>
              <BigNumber value={gpa !== null ? fmtNum(gpa) : '—'} />
              {gpaDelta !== null && gpaDelta !== 0 && (
                <div
                  className="mono tnum"
                  style={{
                    fontSize: 'var(--fs-12)',
                    color: gpaDelta > 0 ? 'var(--ais-forest)' : 'var(--ais-ember)',
                    marginTop: 'var(--s-2)',
                  }}
                >
                  {gpaDelta > 0 ? '↑' : '↓'} {fmtNum(Math.abs(gpaDelta))} к прошлому
                </div>
              )}
              {gpaDelta === null && stats && stats.sampleSize > 0 && (
                <div className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 'var(--s-2)' }}>
                  по {stats.sampleSize} {pluralize(stats.sampleSize, ['аттестации', 'аттестациям', 'аттестациям'])}
                </div>
              )}
            </>
          )}
        </BentoCard>

        {/* ─── Посещаемость ─── */}
        <BentoCard gridArea="attendance" label="Посещаемость">
          {!loaded && !stats ? (
            <>
              <Skeleton width="50%" height={56} />
              <Skeleton width="100%" height={4} style={{ marginTop: 'var(--s-3)' }} />
            </>
          ) : attendance !== null ? (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 4 }}>
                <BigNumber value={String(attendance)} />
                <span className="display" style={{ fontSize: 'var(--fs-22)', color: 'var(--ais-bone-3)' }}>%</span>
              </div>
              <div
                style={{
                  marginTop: 'var(--s-3)',
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--ais-line)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: `${attendance}%`, height: '100%', background: 'var(--ais-forest)', borderRadius: 2 }} />
              </div>
              {stats && stats.currentTerm.attendanceMissedInvalid > 0 && (
                <div className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 'var(--s-2)' }}>
                  без уваж: {stats.currentTerm.attendanceMissedInvalid} ч
                </div>
              )}
            </>
          ) : (
            <BigNumber value="—" tone="muted" />
          )}
        </BentoCard>

        {/* ─── Долги ─── */}
        <BentoCard gridArea="debts" label="Долги">
          {!loaded && !stats ? (
            <>
              <Skeleton width="40%" height={56} />
              <Skeleton width="80%" height={12} style={{ marginTop: 'var(--s-2)' }} />
            </>
          ) : (
            <>
              <BigNumber value={String(debts)} tone={debts > 0 ? 'bad' : 'muted'} />
              {debts > 0 ? (
                <div className="muted" style={{ fontSize: 'var(--fs-13)', marginTop: 'var(--s-2)' }}>
                  {debtsList.slice(0, 2).join(' · ')}
                  {debtsList.length > 2 && ` · +${debtsList.length - 2}`}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 'var(--fs-13)', marginTop: 'var(--s-2)' }}>
                  нет несданных
                </div>
              )}
            </>
          )}
        </BentoCard>

        {/* ─── Расписание сегодня ─── */}
        <BentoCard gridArea="today" className="bento--scroll" padding={false}>
          <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
            <div className="col" style={{ gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--fs-16)', fontWeight: 600 }}>Сегодня</h2>
              <div className="muted" style={{ fontSize: 'var(--fs-13)' }}>
                {todaySection ? `Группа ${todaySection.groupName}` : 'Группа не определена'}
                {today?.snapshot.scheduleDate && ` · ${today.snapshot.scheduleDate}`}
              </div>
            </div>
            <Link href="/schedule" className="btn btn--ghost btn--sm">
              <CalendarDays size={12} strokeWidth={1.75} /> На неделю
            </Link>
          </header>
          {today === null ? (
            <SkeletonRowsBlock count={4} />
          ) : todayLessons.length === 0 ? (
            <RowMuted text="Сегодня пар не запланировано." />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {todayLessons.map((l) => <ScheduleRow key={l.period} item={l} />)}
            </ul>
          )}
        </BentoCard>

        {/* ─── Заявки ─── */}
        <BentoCard gridArea="apps" padding={false}>
          <header className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-4) var(--s-5)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-15)', fontWeight: 600 }}>Заявки</h2>
            <span className="mono muted" style={{ fontSize: 11 }}>{totalApps}</span>
          </header>
          {!loaded ? (
            <SkeletonRowsBlock count={3} />
          ) : totalApps === 0 ? (
            <RowMuted text="В работе нет." />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {certs.map((c) => <CertRowItem key={c.id} item={c} />)}
              {passes.map((p) => <PassRowItem key={p.id} item={p} />)}
            </ul>
          )}
        </BentoCard>

        {/* ─── Быстрые ссылки ─── */}
        <BentoCard gridArea="links" label="Учебный процесс">
          <div className="col" style={{ gap: 'var(--s-2)', marginTop: 'var(--s-2)' }}>
            <Link href="/journal" className="btn btn--ghost" style={{ justifyContent: 'flex-start' }}>
              <BookOpen size={14} strokeWidth={1.75} /> Электронный журнал
              <ArrowRight size={12} strokeWidth={1.75} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            </Link>
            <Link href="/schedule" className="btn btn--ghost" style={{ justifyContent: 'flex-start' }}>
              <CalendarDays size={14} strokeWidth={1.75} /> Расписание группы
              <ArrowRight size={12} strokeWidth={1.75} style={{ marginLeft: 'auto', opacity: 0.6 }} />
            </Link>
          </div>
        </BentoCard>

        {/* ─── Динамика GPA ─── */}
        {stats && stats.perTerm.some((t) => t.gpa !== null) && (
          <BentoCard gridArea="chart" label="Динамика среднего балла">
            <GpaChart data={[...stats.perTerm].filter((t) => t.gpa !== null).reverse()} />
            {student?.gradePointAverage != null && (
              <div className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 'var(--s-3)' }}>
                Балл аттестата при поступлении: <span className="mono tnum">{fmtNum(student.gradePointAverage)}</span>
              </div>
            )}
          </BentoCard>
        )}
      </motion.div>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <style jsx>{`
        :global(.bento-grid) {
          display: grid;
          gap: var(--s-3);
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-template-areas:
            "hero hero gpa attendance"
            "hero hero debts links"
            "today today today apps"
            "today today today apps"
            "chart chart chart chart";
        }
        :global(.bento-card) {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        :global(.bento--hero) {
          justify-content: space-between;
          min-height: 220px;
        }
        :global(.bento--scroll) {
          max-height: 480px;
          overflow-y: auto;
        }
        @media (max-width: 1280px) {
          :global(.bento-grid) {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-template-areas:
              "hero hero hero"
              "gpa attendance debts"
              "today today apps"
              "today today links"
              "chart chart chart";
          }
        }
        @media (max-width: 900px) {
          :global(.bento-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-areas:
              "hero hero"
              "gpa attendance"
              "debts links"
              "today today"
              "apps apps"
              "chart chart";
          }
        }
        @media (max-width: 600px) {
          :global(.bento-grid) {
            grid-template-columns: 1fr;
            grid-template-areas:
              "hero"
              "gpa"
              "attendance"
              "debts"
              "today"
              "apps"
              "links"
              "chart";
          }
        }
      `}</style>
    </div>
  );
}

/* ────────── subcomponents ────────── */

function Skeleton({
  width = '100%',
  height = 16,
  radius = 4,
  style,
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
        width, height,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, var(--ais-paper-2) 0%, var(--ais-line) 50%, var(--ais-paper-2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'aisShimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function SkeletonRowsBlock({ count }: { count: number }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="row"
          style={{
            gap: 'var(--s-4)',
            padding: 'var(--s-3) var(--s-5)',
            borderTop: '1px solid var(--ais-line)',
            alignItems: 'center',
          }}
        >
          <Skeleton width={24} height={14} />
          <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={11} />
          </div>
        </li>
      ))}
    </ul>
  );
}

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

function BentoCard({
  children, gridArea, label, className, padding = true,
}: {
  children: React.ReactNode;
  gridArea: string;
  label?: string;
  className?: string;
  padding?: boolean;
}) {
  return (
    <section
      className={`card bento-card ${className ?? ''}`.trim()}
      style={{
        gridArea,
        padding: padding ? 'var(--s-5)' : 0,
      }}
    >
      {label && (
        <div
          className="mono"
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--ais-bone-3)',
            marginBottom: 'var(--s-3)',
          }}
        >
          {label}
        </div>
      )}
      {children}
    </section>
  );
}

function BigNumber({ value, tone }: { value: string; tone?: 'bad' | 'muted' }) {
  const color =
    tone === 'bad' ? 'var(--ais-ember)' :
    tone === 'muted' ? 'var(--ais-bone-3)' :
    'var(--ais-bone)';
  return (
    <div
      className="display tnum"
      style={{
        fontSize: 'var(--fs-48)', lineHeight: 1, color, fontWeight: 600, letterSpacing: '-0.02em',
      }}
    >
      {value}
    </div>
  );
}

function ScheduleRow({ item }: { item: ChtotibLesson }) {
  return (
    <li className="row" style={{
      gap: 'var(--s-4)',
      padding: 'var(--s-3) var(--s-5)',
      borderTop: '1px solid var(--ais-line)',
      alignItems: 'flex-start',
    }}>
      <div className="mono tnum" style={{ minWidth: 24, fontSize: 'var(--fs-15)', color: 'var(--ais-bone)' }}>
        {item.period}
      </div>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone)' }}>{item.subject}</div>
        <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          {item.teacher || '—'}{item.room && <> · каб. <span className="mono">{item.room}</span></>}
        </div>
      </div>
    </li>
  );
}

function CertRowItem({ item }: { item: CertRow }) {
  return (
    <li className="row" style={{
      gap: 'var(--s-3)', padding: 'var(--s-3) var(--s-5)',
      borderTop: '1px solid var(--ais-line)', alignItems: 'center',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 'var(--r-6)',
        background: 'var(--ais-paper-2)', border: '1px solid var(--ais-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ais-bone-3)', flexShrink: 0,
      }}>
        <FileText size={14} strokeWidth={1.75} />
      </div>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-13)' }}>Справка · {CERT_TYPE_LABEL[item.certType]}</div>
        <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>№ С-{item.displayNo} · {fmtShortDate(item.createdAt)}</div>
      </div>
      <span className="badge badge--warn"><span className="dot" />в работе</span>
    </li>
  );
}

function PassRowItem({ item }: { item: PassRow }) {
  return (
    <li className="row" style={{
      gap: 'var(--s-3)', padding: 'var(--s-3) var(--s-5)',
      borderTop: '1px solid var(--ais-line)', alignItems: 'center',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 'var(--r-6)',
        background: 'var(--ais-paper-2)', border: '1px solid var(--ais-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ais-bone-3)', flexShrink: 0,
      }}>
        <KeyRound size={14} strokeWidth={1.75} />
      </div>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-13)' }}>Пропуск</div>
        <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>{fmtShortDate(item.createdAt)}</div>
      </div>
      <span className="badge badge--warn"><span className="dot" />в работе</span>
    </li>
  );
}

function RowMuted({ text }: { text: string }) {
  return (
    <div className="muted" style={{ padding: 'var(--s-5)', fontSize: 'var(--fs-13)', borderTop: '1px solid var(--ais-line)' }}>
      {text}
    </div>
  );
}

function GpaChart({ data }: { data: TermStats[] }) {
  const values = data.map((d) => d.gpa ?? 0);
  const max = Math.max(...values, 5);
  const min = Math.min(...values, 3);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`,
      gap: 'var(--s-3)', alignItems: 'end', height: 140,
    }}>
      {data.map((d, i) => {
        const v = d.gpa ?? 0;
        const pct = max === min ? 50 : ((v - min) / (max - min)) * 100;
        const isLast = i === data.length - 1;
        return (
          <div key={`${d.year}-${d.term}`} className="col" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <div className="mono tnum" style={{
              fontSize: 11, color: isLast ? 'var(--ais-forest)' : 'var(--ais-bone-3)',
            }}>
              {fmtNum(v)}
            </div>
            <div style={{
              width: '100%',
              height: `${Math.max(20, pct)}%`,
              background: isLast ? 'var(--ais-forest)' : 'var(--ais-paper-2)',
              border: `1px solid ${isLast ? 'var(--ais-forest)' : 'var(--ais-line)'}`,
              borderRadius: 'var(--r-4)',
            }} />
            <div className="mono" style={{ fontSize: 10, color: 'var(--ais-bone-4)', letterSpacing: '0.05em' }}>
              {d.term === 1 ? 'I' : 'II'}·{String(d.year).slice(-2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────── helpers ────────── */

function fmtNum(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const week = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86_400_000 + 1) / 7);
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · неделя ${week}`;
}

function heroLine(lessons: number, apps: number, groupName?: string): string {
  const parts: string[] = [];
  if (groupName) parts.push(`Группа ${groupName}`);
  parts.push(
    lessons > 0
      ? `сегодня ${lessons} ${pluralize(lessons, ['пара', 'пары', 'пар'])}`
      : 'сегодня пар нет',
  );
  if (apps > 0) parts.push(`${apps} ${pluralize(apps, ['заявка', 'заявки', 'заявок'])} в работе`);
  return parts.join(' · ') + '.';
}

function computeAttendancePercent(term: TermStats | undefined): number | null {
  if (!term) return null;
  const baseline = 720;
  const missed = term.attendanceMissedAll;
  if (missed <= 0) return 100;
  const pct = Math.round(((baseline - missed) / baseline) * 100);
  return Math.max(0, Math.min(100, pct));
}

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const teen = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (teen > 1 && teen < 5) return forms[1];
  if (teen === 1) return forms[0];
  return forms[2];
}
