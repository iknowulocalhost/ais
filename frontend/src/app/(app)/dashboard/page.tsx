'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { clsx } from '@/components/clsx';
import type { Role } from '@/lib/types';

/**
 * /dashboard — единая «сводка» для всех ролей.
 * Герой сверху: приветствие + KPI-плитки. Ниже двуколонка:
 * слева «требует внимания», справа «ритм дня».
 */

interface ListPage<T> { items: T[]; total: number }

interface Summary {
  studentsTotal: number | null;
  applicationsNew: number | null;
  paymentsPending: number | null;
  sheetsOpen: number | null;
  expelled: { id: string; name: string }[];
}

const EMPTY: Summary = {
  studentsTotal: null, applicationsNew: null, paymentsPending: null, sheetsOpen: null,
  expelled: [],
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const calls = [
        safe<ListPage<{ id: string; lastName: string; firstName: string; status: string }>>(
          apiFetch('/api/students', { query: { limit: 5, status: 'EXPELLED' } }),
        ),
        safe<ListPage<unknown>>(apiFetch('/api/students', { query: { limit: 1 } })),
        safe<ListPage<unknown>>(apiFetch('/api/applications', { query: { status: 'SUBMITTED', limit: 1 } })),
        safe<ListPage<unknown>>(apiFetch('/api/payments', { query: { status: 'PENDING', limit: 1 } })),
        safe<ListPage<unknown>>(apiFetch('/api/grades/sheets', { query: { status: 'OPEN', limit: 1 } })),
      ];
      const [expelled, students, applications, payments, sheets] = await Promise.all(calls);

      setSummary({
        studentsTotal:    pickTotal(students),
        applicationsNew:  pickTotal(applications),
        paymentsPending:  pickTotal(payments),
        sheetsOpen:       pickTotal(sheets),
        expelled: ((expelled?.items ?? []) as Array<{ id: string; firstName: string; lastName: string }>)
          .slice(0, 4)
          .map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}` })),
      });
      setLoaded(true);
    })();
  }, [user]);

  const greeting = useMemo(() => byHour(now.getHours()), [now]);
  const dateLabel = useMemo(() => formatDate(now), [now]);

  return (
    <div className="col" style={{ gap: 'var(--s-8)' }}>
      {/* ──────────── HERO ──────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--s-6)',
          borderBottom: '1px solid var(--ais-line)',
          paddingBottom: 'var(--s-6)',
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

        <dl className="row" style={{ gap: 'var(--s-7)' }}>
          <Stat label="студентов"   value={summary.studentsTotal}   href="/students" />
          <Stat label="заявок"      value={summary.applicationsNew} href="/applications" tone={summary.applicationsNew ? 'accent' : 'default'} />
          <Stat label="к оплате"    value={summary.paymentsPending} href="/payments" />
          <Stat label="ведомостей"  value={summary.sheetsOpen}      href="/grades" />
        </dl>
      </motion.section>

      {/* ──────────── BODY ──────────── */}
      <div style={{ display: 'grid', gap: 'var(--s-6)', gridTemplateColumns: '1.15fr 0.85fr' }}>
        {/* LEFT — требует внимания */}
        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <header
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--s-4) var(--s-5)',
              borderBottom: '1px solid var(--ais-line)',
            }}
          >
            <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
              требует внимания
            </span>
            <span className="mono muted" style={{ fontSize: 11 }}>
              {loaded ? `${summary.expelled.length} аномалий` : 'собираем…'}
            </span>
          </header>

          {summary.expelled.length === 0 && loaded ? (
            <EmptyAttention />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {summary.expelled.map((s, i) => (
                <AttentionRow
                  key={s.id}
                  idx={i + 1}
                  title={s.name}
                  meta="отчислен"
                  href={`/students/${s.id}`}
                />
              ))}
              {!loaded && (<><SkeletonRow /><SkeletonRow /><SkeletonRow /></>)}
            </ul>
          )}
        </section>

        {/* RIGHT — ритм дня */}
        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <header
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--s-4) var(--s-5)',
              borderBottom: '1px solid var(--ais-line)',
            }}
          >
            <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
              ритм дня
            </span>
            <span className="mono tnum muted" style={{ fontSize: 11 }}>{fmtClock(now)}</span>
          </header>
          <div style={{ padding: 'var(--s-5)' }}>
            <RhythmTimeline now={now} roles={user?.roles ?? []} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ───────────────── helpers & subcomponents ───────────────── */

function Stat({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: number | null;
  href: string;
  tone?: 'default' | 'accent';
}) {
  const display = value === null ? '—' : formatCompact(value);
  const color = tone === 'accent' && value ? 'var(--ais-forest)' : 'var(--ais-bone)';
  return (
    <Link href={href} className="col" style={{ gap: 'var(--s-1)', minWidth: 110, textDecoration: 'none' }}>
      <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
        {label}
      </span>
      <span
        className="display tnum"
        style={{ fontSize: 'var(--fs-48)', lineHeight: 1, color }}
      >
        {display}
      </span>
    </Link>
  );
}

function AttentionRow({
  idx, title, meta, href,
}: {
  idx: number; title: string; meta: string; href: string;
}) {
  return (
    <li style={{ borderBottom: '1px solid var(--ais-line)' }}>
      <Link
        href={href}
        className="row"
        style={{
          alignItems: 'center',
          gap: 'var(--s-4)',
          padding: 'var(--s-4) var(--s-5)',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <span className="mono tnum" style={{ width: 24, textAlign: 'right', fontSize: 10, color: 'var(--ais-bone-4)' }}>
          {String(idx).padStart(2, '0')}
        </span>
        <span style={{ flex: 1, fontSize: 'var(--fs-14)', color: 'var(--ais-bone)' }}>{title}</span>
        <span className="badge badge--bad">{meta}</span>
        <span className="mono muted" style={{ fontSize: 11 }}>→</span>
      </Link>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="row" style={{ alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-4) var(--s-5)' }}>
      <span style={{ height: 10, width: 24, borderRadius: 2, background: 'var(--ais-sub)' }} />
      <span style={{ height: 14, flex: 1, borderRadius: 2, background: 'var(--ais-sub)' }} />
      <span style={{ height: 22, width: 90, borderRadius: 'var(--r-pill)', background: 'var(--ais-sub)' }} />
    </li>
  );
}

function EmptyAttention() {
  return (
    <div className="col" style={{ alignItems: 'center', justifyContent: 'center', gap: 'var(--s-2)', padding: 'var(--s-8) var(--s-5)', textAlign: 'center' }}>
      <span style={{ fontSize: 40, color: 'var(--ais-forest)' }}>◦</span>
      <span style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone-2)' }}>Аномалий нет</span>
      <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
        тишина — нормальное состояние системы
      </span>
    </div>
  );
}

function RhythmTimeline({ now, roles }: { now: Date; roles: Role[] }) {
  const hour = now.getHours();
  const beats = useMemo(() => buildBeats(roles, hour), [roles, hour]);
  return (
    <ol style={{ position: 'relative', listStyle: 'none', margin: 0, padding: '0 0 0 var(--s-5)' }}>
      <span
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: 6,
          top: 6,
          bottom: 6,
          width: 1,
          background: 'var(--ais-line)',
        }}
      />
      {beats.map((b, i) => (
        <li key={i} style={{ position: 'relative', padding: 'var(--s-1) 0' }}>
          <span
            style={{
              position: 'absolute',
              left: -18,
              top: 10,
              height: 8,
              width: 8,
              borderRadius: '50%',
              background: b.passed ? 'var(--ais-forest)' : 'var(--ais-line-strong)',
            }}
          />
          <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s-3)' }}>
            <span className="mono tnum" style={{ width: 48, fontSize: 11, color: 'var(--ais-bone-4)' }}>
              {b.time}
            </span>
            <span className={clsx(b.passed ? undefined : 'muted')} style={{ fontSize: 'var(--fs-13)', color: b.passed ? 'var(--ais-bone)' : undefined }}>
              {b.label}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────── pure helpers ───────────────── */

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; }
  catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    return null;
  }
}

function pickTotal(d: ListPage<unknown> | null): number | null {
  return d?.total ?? null;
}

function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
  return Math.round(n / 1000) + 'k';
}

function byHour(h: number): string {
  if (h < 5)  return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function formatDate(d: Date): string {
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря',
  ];
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildBeats(roles: Role[], hour: number): { time: string; label: string; passed: boolean }[] {
  const isTea = roles.includes('TEA');
  const isCom = roles.includes('COM');
  const isAcc = roles.includes('ACC');
  const isAdm = roles.includes('ADM') || roles.includes('SUPERADMIN');

  const b: { at: number; label: string }[] = [
    { at: 9,  label: 'начало рабочего дня' },
  ];
  if (isCom) b.push({ at: 10, label: 'приём новых заявок' });
  if (isTea) b.push({ at: 11, label: 'проверка ведомостей' });
  if (isAcc) b.push({ at: 12, label: 'сверка платежей за вчера' });
  if (isAdm) b.push({ at: 14, label: 'экспорт еженедельного отчёта' });
  b.push({ at: 18, label: 'окончание смены' });

  return b.map((x) => ({
    time: `${String(x.at).padStart(2, '0')}:00`,
    label: x.label,
    passed: hour >= x.at,
  }));
}
