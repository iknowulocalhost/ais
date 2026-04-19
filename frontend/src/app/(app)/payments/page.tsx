'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import {
  formatKopecks,
  fmtDate,
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentStatus,
} from '@/lib/domain';

interface Page { items: Payment[]; total: number }

export default function PaymentsPage() {
  return (
    <Protected roles={['ADM', 'ACC', 'ANA']}>
      <PaymentsList />
    </Protected>
  );
}

function PaymentsList() {
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<Page>('/api/payments', {
        query: { status: status || undefined, limit: 100 },
      });
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const totalPending = (data?.items ?? [])
    .filter((p) => p.status === 'PENDING')
    .reduce((acc, p) => acc + BigInt(p.amountKopecks), 0n);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Платежи</h1>
          {data && (
            <p className="text-sm text-slate-500">
              К оплате: <span className="font-medium text-slate-800">{formatKopecks(totalPending)}</span>
              {' · '}всего записей: {data.total}
            </p>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Все статусы</option>
          {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!data ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Студент</th>
                <th className="px-4 py-2 font-medium">Назначение</th>
                <th className="px-4 py-2 text-right font-medium">Сумма</th>
                <th className="px-4 py-2 font-medium">Срок</th>
                <th className="px-4 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/students/${p.studentId}`} className="text-blue-700 hover:underline">
                      {p.studentId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-2">{PAYMENT_PURPOSE_LABELS[p.purpose]}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatKopecks(p.amountKopecks)}</td>
                  <td className="px-4 py-2 text-slate-700">{fmtDate(p.dueDate)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${PAYMENT_STATUS_COLORS[p.status]}`}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Нет записей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
