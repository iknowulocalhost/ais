'use client';

/**
 * Индикатор фоновых задач + peak-end toast.
 *
 * В шапке — кнопка со счётчиком активных джобов (pulse-точка для running).
 * При завершении (ok/fail) — тост в правом нижнем углу 6.5с с действием
 * («Скачать xlsx»). Никаких промежуточных уведомлений.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type JobKind = 'report-export' | 'avatar-processing' | 'document-upload';
export type JobStatus = 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  kind: JobKind;
  title: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  action?: { label: string; href: string };
  reason?: string;
}

interface Ctx {
  jobs: Job[];
  active: Job[];
  enqueue: (j: Omit<Job, 'startedAt' | 'status'> & { status?: JobStatus }) => void;
  update: (id: string, patch: Partial<Job>) => void;
  finish: (id: string, result: { action?: Job['action']; reason?: string; ok: boolean }) => void;
}

const BackgroundCtx = createContext<Ctx | null>(null);

export function BackgroundJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [toasts, setToasts] = useState<Job[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const enqueue = useCallback<Ctx['enqueue']>((j) => {
    setJobs((prev) => [...prev, { ...j, status: j.status ?? 'running', startedAt: Date.now() }]);
  }, []);

  const update = useCallback<Ctx['update']>((id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const finish = useCallback<Ctx['finish']>((id, result) => {
    setJobs((prev) => {
      const next = prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status: (result.ok ? 'done' : 'failed') as JobStatus,
              finishedAt: Date.now(),
              action: result.action,
              reason: result.reason,
            }
          : j,
      );
      const finished = next.find((j) => j.id === id);
      if (finished) {
        setToasts((t) => [...t, finished]);
        const timer = setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, 6500);
        toastTimers.current.set(id, timer);
      }
      return next;
    });
  }, []);

  useEffect(() => () => {
    toastTimers.current.forEach((t) => clearTimeout(t));
  }, []);

  const active = useMemo(() => jobs.filter((j) => j.status === 'running'), [jobs]);

  const value: Ctx = { jobs, active, enqueue, update, finish };

  return (
    <BackgroundCtx.Provider value={value}>
      {children}
      <ToastLayer toasts={toasts} onDismiss={(id) => {
        clearTimeout(toastTimers.current.get(id));
        toastTimers.current.delete(id);
        setToasts((t) => t.filter((x) => x.id !== id));
      }} />
    </BackgroundCtx.Provider>
  );
}

export function useBackgroundJobs(): Ctx {
  const v = useContext(BackgroundCtx);
  if (!v) throw new Error('useBackgroundJobs вне BackgroundJobsProvider');
  return v;
}

/* ══════════════ INDICATOR ══════════════ */

const CAPS_LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ais-bone-4)',
};

export function JobsIndicator() {
  const { active, jobs } = useBackgroundJobs();
  const [open, setOpen] = useState(false);

  if (jobs.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Фоновые задачи"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 36,
          width: 36,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ais-bone-2)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25" />
          <path d="M7 3.5v3.5l2.2 2.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        {active.length > 0 && (
          <motion.span
            aria-hidden
            style={{
              position: 'absolute',
              right: 2,
              top: 2,
              height: 10,
              width: 10,
              borderRadius: '50%',
              background: 'var(--ais-forest)',
              boxShadow: '0 0 0 2px var(--ais-ink)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="card"
            style={{
              position: 'absolute',
              right: 0,
              top: 44,
              zIndex: 40,
              width: 340,
              padding: 0,
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--s-3) var(--s-4)',
                borderBottom: '1px solid var(--ais-line)',
              }}
            >
              <span className="mono" style={CAPS_LABEL}>фоновые задачи</span>
              <span className="mono muted" style={{ fontSize: 11 }}>
                {active.length ? `${active.length} активн.` : 'тишина'}
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 340, overflowY: 'auto' }}>
              {jobs.slice().reverse().map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
              {jobs.length === 0 && (
                <li className="muted" style={{ textAlign: 'center', padding: 'var(--s-6) var(--s-4)', fontSize: 'var(--fs-13)' }}>
                  пока нечего показать
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <li
      className="row"
      style={{
        alignItems: 'baseline',
        gap: 'var(--s-2)',
        padding: 'var(--s-3) var(--s-4)',
        borderBottom: '1px solid var(--ais-line)',
      }}
    >
      <StatusMark status={job.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--fs-13)',
            color: 'var(--ais-bone)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {job.title}
        </div>
        <div className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
          {job.kind} · {formatDur(job)}
        </div>
      </div>
      {job.action && job.status === 'done' && (
        <a
          href={job.action.href}
          download
          className="mono"
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ais-forest-hi)',
          }}
        >
          {job.action.label} ↓
        </a>
      )}
    </li>
  );
}

function StatusMark({ status }: { status: JobStatus }) {
  const bg =
    status === 'failed' ? 'var(--ais-ember)' : 'var(--ais-forest)';
  return (
    <span
      aria-hidden
      className={status === 'running' ? 'pulse-dot' : undefined}
      style={{
        marginTop: 6,
        display: 'block',
        height: 8,
        width: 8,
        flexShrink: 0,
        borderRadius: '50%',
        background: bg,
        opacity: status === 'running' ? 0.85 : 1,
      }}
    />
  );
}

function formatDur(j: Job): string {
  const end = j.finishedAt ?? Date.now();
  const s = Math.round((end - j.startedAt) / 1000);
  if (s < 60) return `${s}с`;
  return `${Math.floor(s / 60)}м ${s % 60}с`;
}

/* ══════════════ TOAST LAYER ══════════════ */

function ToastLayer({ toasts, onDismiss }: { toasts: Job[]; onDismiss: (id: string) => void }) {
  return (
    <div
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        inset: 'auto 0 0 0',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--s-2)',
        padding: 'var(--s-5)',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 280, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, transition: { duration: 0.18 } }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="card"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              gap: 'var(--s-2)',
              alignItems: 'flex-start',
              width: 360,
              padding: 'var(--s-3) var(--s-4)',
              borderColor: t.status === 'failed' ? 'var(--ais-ember-wash)' : 'var(--ais-line)',
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            <span
              style={{
                marginTop: 8,
                height: 8,
                width: 8,
                flexShrink: 0,
                borderRadius: '50%',
                background: t.status === 'failed' ? 'var(--ais-ember)' : 'var(--ais-forest)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={CAPS_LABEL}>
                {t.status === 'done' ? 'готово' : 'ошибка'} · {t.kind}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 'var(--fs-13)',
                  color: 'var(--ais-bone)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.title}
              </div>
              {t.reason && (
                <div style={{ marginTop: 'var(--s-1)', fontSize: 'var(--fs-13)', color: 'var(--ais-bone-3)' }}>
                  {t.reason}
                </div>
              )}
              {t.action && t.status === 'done' && (
                <a
                  href={t.action.href}
                  download
                  className="btn btn--primary btn--sm"
                  style={{ marginTop: 'var(--s-2)', display: 'inline-flex' }}
                >
                  {t.action.label} ↓
                </a>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Скрыть"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ais-bone-4)',
                fontSize: 14,
                padding: 0,
              }}
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
