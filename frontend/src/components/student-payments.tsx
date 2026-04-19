'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  formatKopecks,
  fmtDate,
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentPurpose,
} from '@/lib/domain';

const PURPOSES = Object.keys(PAYMENT_PURPOSE_LABELS) as PaymentPurpose[];

interface Page { items: Payment[]; total: number }

export function StudentPayments({ studentId }: { studentId: string }) {
  const { hasRole } = useAuth();
  const canIssue = hasRole(['ADM', 'ACC']);
  const canMarkPaid = hasRole(['ADM', 'ACC']);

  const [page, setPage] = useState<Page | null>(null);
  const [paid, setPaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, b] = await Promise.all([
        apiFetch<Page>('/api/payments', { query: { studentId, limit: 100 } }),
        hasRole(['ADM', 'ACC', 'ANA'])
          ? apiFetch<{ paidKopecks: string }>(`/api/payments/students/${studentId}/balance`).then((r) => r.paidKopecks)
          : Promise.resolve(null),
      ]);
      setPage(p);
      setPaid(b);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [studentId, hasRole]);

  useEffect(() => { void load(); }, [load]);

  async function markPaid(id: string) {
    const ref = window.prompt('Внешний референс оплаты (если есть):')?.trim() || undefined;
    try {
      await apiFetch(`/api/payments/${id}/mark-paid`, {
        method: 'POST',
        body: { externalRef: ref },
      });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Платежи</h2>
          {paid && (
            <p className="text-sm text-slate-500">
              Оплачено: <span className="font-medium text-slate-800">{formatKopecks(paid)}</span>
            </p>
          )}
        </div>
        {canIssue && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            {showForm ? 'Отмена' : 'Выставить'}
          </button>
        )}
      </div>

      {error && <div className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <IssuePaymentForm
          studentId={studentId}
          onDone={() => { setShowForm(false); void load(); }}
        />
      )}

      <div className="mt-3 overflow-hidden rounded-md ring-1 ring-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Назначение</th>
              <th className="px-3 py-2 text-right font-medium">Сумма</th>
              <th className="px-3 py-2 font-medium">Срок</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(page?.items ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">{PAYMENT_PURPOSE_LABELS[p.purpose]}</td>
                <td className="px-3 py-2 text-right font-medium">{formatKopecks(p.amountKopecks)}</td>
                <td className="px-3 py-2 text-slate-700">{fmtDate(p.dueDate)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PAYMENT_STATUS_COLORS[p.status]}`}>
                    {PAYMENT_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {canMarkPaid && p.status === 'PENDING' && (
                    <button onClick={() => markPaid(p.id)}
                      className="text-xs text-emerald-700 hover:underline">Отметить оплату</button>
                  )}
                </td>
              </tr>
            ))}
            {page && page.items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">Начислений нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IssuePaymentForm({
  studentId,
  onDone,
}: {
  studentId: string;
  onDone: () => void;
}) {
  const [purpose, setPurpose] = useState<PaymentPurpose>('TUITION');
  const [rubles, setRubles] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // «1234,56» или «1234.56» → строка копеек без потерь (через парсинг целых и дроби)
    const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(rubles.trim());
    if (!match) {
      setErr('Сумма должна быть в рублях, например 12500 или 12500,50');
      return;
    }
    const whole = match[1];
    const frac = (match[2] ?? '').padEnd(2, '0');
    const kopecks = `${whole}${frac}`.replace(/^0+(?=\d)/, '');
    setBusy(true);
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: {
          studentId,
          purpose,
          amountKopecks: kopecks,
          dueDate,
          comment: comment || undefined,
        },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-4">
      <label className="block text-sm">
        Назначение
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as PaymentPurpose)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1">
          {PURPOSES.map((p) => (<option key={p} value={p}>{PAYMENT_PURPOSE_LABELS[p]}</option>))}
        </select>
      </label>
      <label className="block text-sm">
        Сумма (₽)
        <input value={rubles} onChange={(e) => setRubles(e.target.value)} required
          placeholder="12500,00"
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <label className="block text-sm">
        Срок
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <label className="block text-sm">
        Комментарий
        <input value={comment} onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>

      {err && <div className="sm:col-span-4 rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}

      <div className="sm:col-span-4 flex justify-end">
        <button disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Сохраняем…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}
