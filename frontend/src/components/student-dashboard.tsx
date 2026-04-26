'use client';

import { useMemo } from 'react';
import { Bell, Plus, ArrowRight, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { clsx } from './clsx';

/**
 * Дашборд студента (роль STU).
 * Все цифры — заглушки (нет соответствующих эндпоинтов).
 * TODO-метки расставлены в местах подключения данных.
 */

interface ScheduleItem {
  start: string;
  end: string;
  title: string;
  teacher: string;
  room: string;
  status: 'now' | 'soon' | 'later' | 'deadline';
  statusLabel: string;
}

interface Application {
  title: string;
  meta: string;
  status: 'review' | 'approved';
  statusLabel: string;
}

// TODO: подменить на /api/students/me/today (нет на бэке)
const SCHEDULE: ScheduleItem[] = [
  { start: '09:00', end: '10:30', title: 'Математический анализ', teacher: 'Петрова Е.С.', room: 'ауд. 214', status: 'now',      statusLabel: 'идёт сейчас' },
  { start: '10:45', end: '12:15', title: 'Алгоритмы',             teacher: 'Соловьёв М.Р.', room: 'ауд. 312', status: 'soon',     statusLabel: 'через 1ч 45м' },
  { start: '14:00', end: '15:30', title: 'Базы данных',           teacher: 'Кузнецов В.И.', room: 'ауд. 118', status: 'later',    statusLabel: 'позже' },
  { start: '23:59', end: '',      title: 'Дедлайн: лаб. работа №4', teacher: 'БД',          room: 'Кузнецов В.И.', status: 'deadline', statusLabel: 'до 23:59' },
];

const APPLICATIONS: Application[] = [
  { title: 'Справка об обучении', meta: 'заявка №2410 · 18 апр',           status: 'review',   statusLabel: 'проверка' },
  { title: 'Пропуск 15 апр',      meta: 'по уважительной причине',          status: 'approved', statusLabel: 'одобрен' },
];

// TODO: динамика GPA — /api/students/me/gpa-history
const GPA_HISTORY = [
  { label: 'М1·25', value: 4.0 },
  { label: 'М2·25', value: 4.2 },
  { label: 'М3·25', value: 4.1 },
  { label: 'М4·25', value: 4.4 },
  { label: 'М1·26', value: 4.59 },
  { label: 'М2·26', value: 4.71, current: true },
];

export function StudentDashboard() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDate(now), [now]);

  // TODO: модуль/неделя — /api/calendar/current
  const moduleDaysLeft = 12;
  const todayClasses = 3;
  const todayDeadlines = 1;

  // TODO: KPI — /api/students/me/kpi
  const gpa = 4.71;
  const gpaDelta = 0.12;
  const attendance = 92;
  const debts = 2;
  const debtsList = ['Алгоритмы', 'История'];

  return (
    <div className="col" style={{ gap: 'var(--s-7)' }}>
      {/* ─── HERO ─── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--s-6)' }}
      >
        <div className="col" style={{ gap: 'var(--s-3)' }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--ais-bone-4)',
            }}
          >
            {dateLabel}
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1.05, margin: 0 }}>
            Привет, <span style={{ color: 'var(--ais-forest)' }}>{user?.firstName ?? '…'}</span>.
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--fs-15)', color: 'var(--ais-bone-2)' }}>
            До конца модуля {moduleDaysLeft} дней. Сегодня — {todayClasses} пары, {todayDeadlines} дедлайн.
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <button type="button" className="btn btn--outline btn--icon" aria-label="Уведомления">
            <Bell size={16} strokeWidth={1.75} />
          </button>
          <button type="button" className="btn btn--primary">
            <Plus size={16} strokeWidth={2} />
            Заказать справку
          </button>
        </div>
      </motion.section>

      {/* ─── KPI ─── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--s-4)',
        }}
      >
        <KpiCard label="GPA · семестр">
          <BigNumber value={fmtNum(gpa)} />
          <div className="mono tnum" style={{ fontSize: 'var(--fs-12)', color: 'var(--ais-forest)', marginTop: 'var(--s-2)' }}>
            ↑ {fmtNum(gpaDelta)}
          </div>
        </KpiCard>

        <KpiCard label="Посещаемость">
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
            <div
              style={{
                width: `${attendance}%`,
                height: '100%',
                background: 'var(--ais-forest)',
                borderRadius: 2,
              }}
            />
          </div>
        </KpiCard>

        <KpiCard label="Долги">
          <BigNumber value={String(debts)} tone="bad" />
          <div className="muted" style={{ fontSize: 'var(--fs-13)', marginTop: 'var(--s-2)' }}>
            {debtsList.join(' · ')}
          </div>
        </KpiCard>
      </section>

      {/* ─── BODY GRID ─── */}
      <div style={{ display: 'grid', gap: 'var(--s-4)', gridTemplateColumns: '1.4fr 1fr' }}>
        {/* TODAY */}
        <section className="card" style={{ padding: 0 }}>
          <header
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: 'var(--s-5) var(--s-5) var(--s-3)',
            }}
          >
            <div className="col" style={{ gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--fs-16)', fontWeight: 600 }}>Сегодня</h2>
              <div className="muted" style={{ fontSize: 'var(--fs-13)' }}>
                {todayClasses} пары, {todayDeadlines} дедлайн · корпус Б
              </div>
            </div>
            <DayWeekTabs />
          </header>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {SCHEDULE.map((s, i) => (
              <ScheduleRow key={i} item={s} />
            ))}
          </ul>
        </section>

        {/* RIGHT COLUMN */}
        <div className="col" style={{ gap: 'var(--s-4)' }}>
          {/* Applications */}
          <section className="card" style={{ padding: 0 }}>
            <header
              className="row"
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--s-4) var(--s-5)',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 'var(--fs-15)', fontWeight: 600 }}>Заявки в работе</h2>
              <a
                href="/applications"
                className="muted"
                style={{
                  fontSize: 'var(--fs-13)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                все <ArrowRight size={12} />
              </a>
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {APPLICATIONS.map((a, i) => (
                <ApplicationRow key={i} item={a} />
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* GPA CHART */}
      <section className="card" style={{ padding: 'var(--s-5)' }}>
        <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--s-5)' }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-15)', fontWeight: 600 }}>
              Динамика GPA · последние 6 модулей
            </h2>
            <div className="muted" style={{ fontSize: 'var(--fs-13)' }}>
              Лучше, чем 82% группы
            </div>
          </div>
        </header>
        <GpaChart data={GPA_HISTORY} />
      </section>
    </div>
  );
}

/* ────────── subcomponents ────────── */

function KpiCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--s-5)',
        minHeight: 168,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
      {children}
    </div>
  );
}

function BigNumber({
  value,
  suffix,
  tone,
}: {
  value: string;
  suffix?: string;
  tone?: 'bad';
}) {
  const color = tone === 'bad' ? 'var(--ais-ember)' : 'var(--ais-bone)';
  return (
    <div
      className="display tnum"
      style={{
        fontSize: 'var(--fs-48)',
        lineHeight: 1,
        color,
        fontWeight: 600,
        letterSpacing: '-0.02em',
      }}
    >
      {value}
      {suffix && (
        <span style={{ fontSize: 'var(--fs-22)', color: 'var(--ais-bone-3)', marginLeft: 4 }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function DayWeekTabs() {
  // TODO: переключение day/week
  return (
    <div
      className="row"
      style={{
        background: 'var(--ais-paper-2)',
        borderRadius: 'var(--r-8)',
        padding: 2,
        gap: 0,
      }}
    >
      <button
        type="button"
        className="btn btn--sm"
        style={{
          background: 'var(--ais-line)',
          borderColor: 'transparent',
          color: 'var(--ais-bone)',
        }}
      >
        День
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
      >
        Неделя
      </button>
    </div>
  );
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const isDeadline = item.status === 'deadline';
  return (
    <li
      className="row"
      style={{
        gap: 'var(--s-4)',
        padding: 'var(--s-4) var(--s-5)',
        borderTop: '1px solid var(--ais-line)',
        alignItems: 'flex-start',
      }}
    >
      <div className="mono tnum" style={{ minWidth: 64, lineHeight: 1.4 }}>
        <div style={{ fontSize: 'var(--fs-15)', color: 'var(--ais-bone)' }}>{item.start}</div>
        {item.end && (
          <div style={{ fontSize: 'var(--fs-12)', color: 'var(--ais-bone-4)' }}>{item.end}</div>
        )}
      </div>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone)' }}>{item.title}</div>
        <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          {item.teacher} · {item.room}
        </div>
      </div>
      <span
        className={clsx(
          'badge',
          item.status === 'now' && 'badge--ok',
          isDeadline && 'badge--bad',
        )}
      >
        <span className="dot" />
        {item.statusLabel}
      </span>
    </li>
  );
}

function ApplicationRow({ item }: { item: Application }) {
  return (
    <li
      className="row"
      style={{
        gap: 'var(--s-3)',
        padding: 'var(--s-3) var(--s-5)',
        borderTop: '1px solid var(--ais-line)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--r-6)',
          background: 'var(--ais-paper-2)',
          border: '1px solid var(--ais-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ais-bone-3)',
          flexShrink: 0,
        }}
      >
        <FileText size={14} strokeWidth={1.75} />
      </div>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-13)', color: 'var(--ais-bone)' }}>{item.title}</div>
        <div className="muted" style={{ fontSize: 'var(--fs-12)' }}>{item.meta}</div>
      </div>
      <span className={clsx('badge', item.status === 'review' ? 'badge--warn' : 'badge--ok')}>
        <span className="dot" />
        {item.statusLabel}
      </span>
    </li>
  );
}

function GpaChart({
  data,
}: {
  data: { label: string; value: number; current?: boolean }[];
}) {
  const max = Math.max(...data.map((d) => d.value));
  const min = 3.5;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 'var(--s-3)', alignItems: 'end', height: 160 }}>
      {data.map((d, i) => {
        const pct = ((d.value - min) / (max - min)) * 100;
        return (
          <div key={i} className="col" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <div
              className="mono tnum"
              style={{ fontSize: 11, color: d.current ? 'var(--ais-forest)' : 'var(--ais-bone-3)' }}
            >
              {fmtNum(d.value)}
            </div>
            <div
              style={{
                width: '100%',
                height: `${Math.max(20, pct)}%`,
                background: d.current ? 'var(--ais-forest)' : 'var(--ais-paper-2)',
                border: `1px solid ${d.current ? 'var(--ais-forest)' : 'var(--ais-line)'}`,
                borderRadius: 'var(--r-4)',
              }}
            />
            <div className="mono" style={{ fontSize: 10, color: 'var(--ais-bone-4)', letterSpacing: '0.05em' }}>
              {d.label}
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
function formatDate(d: Date): string {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const week = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86_400_000 + 1) / 7);
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · неделя ${week}`;
}
