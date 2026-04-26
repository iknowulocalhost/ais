'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import {
  formatKopecks,
  fmtDate,
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentStatus,
} from '@/lib/domain';

interface Page { items: Payment[]; total: number }

const STATUS_VARIANT: Record<PaymentStatus, string> = {
  PENDING: 'badge--warn',
  PAID: 'badge--ok',
  CANCELLED: '',
  REFUNDED: '',
};

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
      setError(explainError(e).hint);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const totalPending = (data?.items ?? [])
    .filter((p) => p.status === 'PENDING')
    .reduce((acc, p) => acc + BigInt(p.amountKopecks), 0n);

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 'var(--s-1)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Платежи</h1>
          {data && (
            <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
              К оплате: <span className="tnum" style={{ color: 'var(--ais-bone)' }}>{formatKopecks(totalPending)}</span>
              {' · '}всего записей: <span className="tnum">{data.total}</span>
            </p>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}
          className="input"
          style={{ width: 'auto' }}
        >
          <option value="">Все статусы</option>
          {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {!data ? (
        <div className="muted">Загрузка…</div>
      ) : (
        <div className="card card--bleed">
          <table className="table">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Назначение</th>
                <th style={{ textAlign: 'right' }}>Сумма</th>
                <th>Срок</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/students/${p.studentId}`} className="mono" style={{ color: 'var(--ais-forest-hi)' }}>
                      {p.studentId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td>{PAYMENT_PURPOSE_LABELS[p.purpose]}</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{formatKopecks(p.amountKopecks)}</td>
                  <td className="mono muted">{fmtDate(p.dueDate)}</td>
                  <td>
                    <span className={`badge ${STATUS_VARIANT[p.status]}`}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 'var(--s-6)' }}>
                    Нет записей
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
