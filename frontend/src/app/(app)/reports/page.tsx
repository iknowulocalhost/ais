'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { REPORT_KIND_LABELS, type ReportExport, type ReportKind } from '@/lib/domain';
import { useBackgroundJobs } from '@/components/background-jobs';

/**
 * Отчёты. Интеграция с фоновыми задачами:
 *   · enqueue(id) при POST /reports/exports
 *   · finish(id, {ok, action}) при переходе в READY/FAILED
 */

export default function ReportsPage() {
  return (
    <Protected roles={['ADM', 'ACC', 'ANA']}>
      <ReportsView />
    </Protected>
  );
}

const STATUS_VARIANT: Record<ReportExport['status'], string> = {
  QUEUED: '',
  RUNNING: 'badge--warn',
  READY: 'badge--ok',
  FAILED: 'badge--bad',
};

const STATUS_LABEL: Record<ReportExport['status'], string> = {
  QUEUED: 'в очереди',
  RUNNING: 'формируется',
  READY: 'готов',
  FAILED: 'ошибка',
};

function ReportsView() {
  const [kind, setKind] = useState<ReportKind>('STUDENTS_ROSTER');
  const [tracked, setTracked] = useState<ReportExport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const pollRef = useRef<number | null>(null);
  const notified = useRef<Set<string>>(new Set());
  const jobs = useBackgroundJobs();

  const tick = useCallback(async () => {
    const pending = tracked.filter((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (pending.length === 0) return;
    try {
      const updated = await Promise.all(
        pending.map((r) => apiFetch<ReportExport>(`/api/reports/exports/${r.id}`)),
      );
      setTracked((prev) => prev.map((r) => updated.find((u) => u.id === r.id) ?? r));

      for (const u of updated) {
        const terminal = u.status === 'READY' || u.status === 'FAILED';
        if (terminal && !notified.current.has(u.id)) {
          notified.current.add(u.id);
          jobs.finish(u.id, {
            ok: u.status === 'READY',
            action: u.status === 'READY' && u.downloadUrl
              ? { label: 'скачать xlsx', href: u.downloadUrl }
              : undefined,
            reason: u.errorMessage ?? undefined,
          });
        }
      }
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [tracked, jobs]);

  useEffect(() => {
    const hasPending = tracked.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (!hasPending) {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current === null) {
      pollRef.current = window.setInterval(() => void tick(), 2000);
    }
    return () => {
      if (pollRef.current !== null && !hasPending) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [tracked, tick]);

  async function requestExport() {
    setError(null);
    setQueueing(true);
    try {
      const created = await apiFetch<ReportExport>('/api/reports/exports', {
        method: 'POST',
        body: { kind, params: {} },
      });
      setTracked((prev) => [created, ...prev]);
      jobs.enqueue({
        id: created.id,
        kind: 'report-export',
        title: REPORT_KIND_LABELS[created.kind],
      });
    } catch (e) {
      setError(explainError(e).hint);
    } finally {
      setQueueing(false);
    }
  }

  return (
    <div className="col" style={{ gap: 'var(--s-6)' }}>
      <header
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--s-5)',
          borderBottom: '1px solid var(--ais-line)',
          paddingBottom: 'var(--s-5)',
        }}
      >
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Отчёты</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-13)', maxWidth: '54ch' }}>
            Экспорт формируется в фоне. Большие выгрузки не блокируют работу;
            о завершении вы узнаете из тоста в правом нижнем углу.
          </p>
        </div>
      </header>

      {/* NEW EXPORT */}
      <section className="card">
        <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          новый экспорт
        </span>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--s-3)', marginTop: 'var(--s-4)' }}>
          <label className="field" style={{ minWidth: 260 }}>
            <span className="field__label">тип отчёта</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ReportKind)}
              className="input"
            >
              {(Object.keys(REPORT_KIND_LABELS) as ReportKind[]).map((k) => (
                <option key={k} value={k}>{REPORT_KIND_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <button
            className="btn btn--primary"
            onClick={() => void requestExport()}
            disabled={queueing}
          >
            {queueing ? 'в очередь…' : 'Поставить в очередь →'}
          </button>
        </div>
      </section>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {/* TRACKED LIST */}
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
            запросы в этой сессии
          </span>
          <span className="mono tnum muted" style={{ fontSize: 11 }}>
            {tracked.length} шт.
          </span>
        </header>

        {tracked.length === 0 ? (
          <div style={{ padding: 'var(--s-8) var(--s-5)', textAlign: 'center' }}>
            <span className="mono muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              пусто
            </span>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tracked.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                className="row"
                style={{
                  alignItems: 'center',
                  gap: 'var(--s-4)',
                  padding: 'var(--s-3) var(--s-5)',
                  borderBottom: '1px solid var(--ais-line)',
                }}
              >
                <StatusGlyph status={r.status} />
                <div className="col" style={{ minWidth: 0, flex: 1, gap: 2 }}>
                  <div style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {REPORT_KIND_LABELS[r.kind]}
                  </div>
                  <div className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    id {r.id.slice(0, 8)} · {new Date(r.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    {r.errorMessage && ` · ${r.errorMessage}`}
                  </div>
                </div>
                <span className={`badge ${STATUS_VARIANT[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                {r.status === 'READY' && r.downloadUrl && (
                  <a href={r.downloadUrl} download className="btn btn--primary btn--sm">
                    скачать xlsx ↓
                  </a>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusGlyph({ status }: { status: ReportExport['status'] }) {
  if (status === 'RUNNING') {
    return (
      <motion.span
        aria-hidden
        style={{
          height: 10,
          width: 10,
          borderRadius: '50%',
          border: '1.5px solid var(--ais-forest)',
          borderRightColor: 'transparent',
        }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
      />
    );
  }
  const bg =
    status === 'READY' ? 'var(--ais-forest)' :
    status === 'FAILED' ? 'var(--ais-ember)' :
    'var(--ais-line-strong)';
  return (
    <span
      aria-hidden
      style={{ display: 'block', height: 10, width: 10, borderRadius: '50%', background: bg }}
    />
  );
}
