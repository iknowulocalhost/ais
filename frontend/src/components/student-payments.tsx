'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  formatKopecks,
  fmtDate,
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentPurpose,
  type PaymentStatus,
} from '@/lib/domain';

const PURPOSES = Object.keys(PAYMENT_PURPOSE_LABELS) as PaymentPurpose[];

const STATUS_VARIANT: Record<PaymentStatus, string> = {
  PENDING: 'badge--warn',
  PAID: 'badge--ok',
  CANCELLED: '',
  REFUNDED: '',
};

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
      setError(explainError(e).hint);
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
      alert(explainError(e).hint);
    }
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col" style={{ gap: 'var(--s-1)' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-20)' }}>Платежи</h2>
          {paid && (
            <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
              Оплачено: <span className="tnum" style={{ color: 'var(--ais-bone)' }}>{formatKopecks(paid)}</span>
            </p>
          )}
        </div>
        {canIssue && (
          <button onClick={() => setShowForm((v) => !v)} className="btn btn--primary btn--sm">
            {showForm ? 'Отмена' : 'Выставить'}
          </button>
        )}
      </div>

      {error && <div className="callout callout--danger" style={{ marginTop: 'var(--s-3)' }}><span>{error}</span></div>}

      {showForm && (
        <IssuePaymentForm
          studentId={studentId}
          onDone={() => { setShowForm(false); void load(); }}
        />
      )}

      <div className="card card--bleed" style={{ marginTop: 'var(--s-3)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Назначение</th>
              <th style={{ textAlign: 'right' }}>Сумма</th>
              <th>Срок</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(page?.items ?? []).map((p) => (
              <tr key={p.id}>
                <td>{PAYMENT_PURPOSE_LABELS[p.purpose]}</td>
                <td className="tnum" style={{ textAlign: 'right' }}>{formatKopecks(p.amountKopecks)}</td>
                <td className="mono muted">{fmtDate(p.dueDate)}</td>
                <td>
                  <span className={`badge ${STATUS_VARIANT[p.status]}`}>
                    {PAYMENT_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {canMarkPaid && p.status === 'PENDING' && (
                    <button onClick={() => markPaid(p.id)} className="btn btn--primary btn--sm">
                      Отметить оплату
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {page && page.items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 'var(--s-5)' }}>
                  Начислений нет
                </td>
              </tr>
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
      setErr(explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--s-3)',
        marginTop: 'var(--s-4)',
        padding: 'var(--s-4)',
        background: 'var(--ais-sub)',
        border: '1px solid var(--ais-line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <label className="field">
        <span className="field__label">Назначение</span>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as PaymentPurpose)} className="input">
          {PURPOSES.map((p) => (<option key={p} value={p}>{PAYMENT_PURPOSE_LABELS[p]}</option>))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Сумма (₽)</span>
        <input value={rubles} onChange={(e) => setRubles(e.target.value)} required
          placeholder="12500,00" className="input" />
      </label>
      <label className="field">
        <span className="field__label">Срок</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="input" />
      </label>
      <label className="field">
        <span className="field__label">Комментарий</span>
        <input value={comment} onChange={(e) => setComment(e.target.value)} className="input" />
      </label>

      {err && <div className="callout callout--danger" style={{ gridColumn: '1 / -1' }}><span>{err}</span></div>}

      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={busy} className="btn btn--primary">
          {busy ? 'Сохраняем…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}
