'use client';

import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';

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

const STATUS_COLORS: Record<Status, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  ENROLLED: 'bg-blue-100 text-blue-800',
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
      setError((e as Error).message);
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
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Заявки абитуриентов</h1>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Status | '')}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Все статусы</option>
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {data && <span className="text-sm text-slate-500">всего: {data.total}</span>}
        </div>
      </div>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!data ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">ФИО</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Направление</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{a.lastName} {a.firstName}</td>
                  <td className="px-4 py-2 text-slate-700">{a.email}</td>
                  <td className="px-4 py-2 text-slate-700">{a.programCode}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {(a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && (
                        <>
                          {a.status === 'SUBMITTED' && (
                            <button onClick={() => decide(a.id, 'TAKE')} disabled={busy === a.id}
                              className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                              Взять
                            </button>
                          )}
                          <button onClick={() => decide(a.id, 'ACCEPT')} disabled={busy === a.id}
                            className="text-xs text-emerald-700 hover:underline disabled:opacity-50">
                            Одобрить
                          </button>
                          <button onClick={() => decide(a.id, 'REJECT')} disabled={busy === a.id}
                            className="text-xs text-rose-700 hover:underline disabled:opacity-50">
                            Отклонить
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Нет заявок</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
