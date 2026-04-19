'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { REPORT_KIND_LABELS, type ReportExport, type ReportKind } from '@/lib/domain';

export default function ReportsPage() {
  return (
    <Protected roles={['ADM', 'ACC', 'ANA']}>
      <ReportsView />
    </Protected>
  );
}

function ReportsView() {
  const [kind, setKind] = useState<ReportKind>('STUDENTS_ROSTER');
  const [tracked, setTracked] = useState<ReportExport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Поллим статус «не окончательных» экспортов раз в 2 сек. Останавливаемся,
  // когда все либо READY, либо FAILED — не жжём ресурсы зря.
  const tick = useCallback(async () => {
    const pending = tracked.filter((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (pending.length === 0) return;
    try {
      const updated = await Promise.all(
        pending.map((r) => apiFetch<ReportExport>(`/api/reports/exports/${r.id}`)),
      );
      setTracked((prev) =>
        prev.map((r) => updated.find((u) => u.id === r.id) ?? r),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tracked]);

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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setQueueing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Отчёты</h1>
        <p className="text-sm text-slate-500">
          Экспорт генерируется фоном в XLSX. Большие выгрузки не блокируют UI.
        </p>
      </header>

      <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Новый экспорт</h2>
        <div className="mt-3 flex items-end gap-3">
          <label className="flex-1 text-sm">
            Тип отчёта
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ReportKind)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5"
            >
              {(Object.keys(REPORT_KIND_LABELS) as ReportKind[]).map((k) => (
                <option key={k} value={k}>{REPORT_KIND_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void requestExport()}
            disabled={queueing}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {queueing ? 'В очередь…' : 'Поставить в очередь'}
          </button>
        </div>
      </section>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Запросы в этой сессии</h2>
        {tracked.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Пока ничего — поставьте экспорт выше.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {tracked.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{REPORT_KIND_LABELS[r.kind]}</div>
                  <div className="text-xs text-slate-500">id: {r.id}</div>
                  {r.errorMessage && (
                    <div className="text-xs text-rose-700">{r.errorMessage}</div>
                  )}
                </div>
                <StatusCell r={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusCell({ r }: { r: ReportExport }) {
  if (r.status === 'READY' && r.downloadUrl) {
    return (
      <a
        href={r.downloadUrl}
        className="rounded-md bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
        download
      >
        Скачать XLSX
      </a>
    );
  }
  const colors: Record<ReportExport['status'], string> = {
    QUEUED: 'bg-slate-100 text-slate-700',
    RUNNING: 'bg-amber-100 text-amber-800',
    READY: 'bg-emerald-100 text-emerald-800',
    FAILED: 'bg-rose-100 text-rose-800',
  };
  const labels: Record<ReportExport['status'], string> = {
    QUEUED: 'В очереди',
    RUNNING: 'Генерация…',
    READY: 'Готов',
    FAILED: 'Ошибка',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${colors[r.status]}`}>
      {labels[r.status]}
    </span>
  );
}
