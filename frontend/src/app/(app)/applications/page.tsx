'use client';

import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

type Status = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'ENROLLED';

interface AppRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  programCode: string;
  status: Status;
  createdAt: string;
}

interface AppsPage {
  total: number;
  items: AppRow[];
}

const STATUS_LABELS: Record<Status, string> = {
  SUBMITTED: 'Подана',
  UNDER_REVIEW: 'В работе',
  ACCEPTED: 'Одобрена',
  REJECTED: 'Отклонена',
  ENROLLED: 'Зачислен',
};

const STATUS_VARIANT: Record<Status, string> = {
  SUBMITTED: '',
  UNDER_REVIEW: 'badge--warn',
  ACCEPTED: 'badge--ok',
  REJECTED: 'badge--bad',
  ENROLLED: 'badge--ok',
};

export default function ApplicationsPage() {
  return (
    <Protected roles={['ADM', 'COM']}>
      <ApplicationsList />
    </Protected>
  );
}

function ApplicationsList() {
  const [filter, setFilter] = useState<Status | ''>('');
  const [data, setData] = useState<AppsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<AppsPage>('/api/applications', {
        query: { status: filter || undefined, limit: 100 },
      });
      setData(d);
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, decision: 'TAKE' | 'ACCEPT' | 'REJECT') {
    const reason =
      decision === 'REJECT' ? window.prompt('Причина отказа:')?.trim() || undefined : undefined;
    if (decision === 'REJECT' && !reason) return;
    setBusy(id);
    try {
      await apiFetch(`/api/applications/${id}/review`, {
        method: 'POST',
        body: { decision, reason },
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Заявки абитуриентов</h1>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Status | '')}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="">Все статусы</option>
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {data && (
            <span className="mono muted">
              всего: <span className="tnum">{data.total}</span>
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="callout callout--danger"><span>{error}</span></div>
      )}

      {!data ? (
        <div className="muted">Загрузка…</div>
      ) : (
        <div className="card card--bleed">
          <table className="table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Email</th>
                <th>Направление</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.lastName} {a.firstName}</td>
                  <td className="muted">{a.email}</td>
                  <td className="mono">{a.programCode}</td>
                  <td>
                    <span className={`badge ${STATUS_VARIANT[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 'var(--s-2)' }}>
                      {(a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && (
                        <>
                          {a.status === 'SUBMITTED' && (
                            <button
                              onClick={() => decide(a.id, 'TAKE')}
                              disabled={busy === a.id}
                              className="btn btn--ghost btn--sm"
                            >
                              Взять
                            </button>
                          )}
                          <button
                            onClick={() => decide(a.id, 'ACCEPT')}
                            disabled={busy === a.id}
                            className="btn btn--primary btn--sm"
                          >
                            Одобрить
                          </button>
                          <button
                            onClick={() => decide(a.id, 'REJECT')}
                            disabled={busy === a.id}
                            className="btn btn--danger btn--sm"
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 'var(--s-6)' }}>
                    Нет заявок
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
