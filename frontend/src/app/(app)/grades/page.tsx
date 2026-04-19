'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  fmtDate,
  GRADE_SHEET_STATUS_COLORS,
  GRADE_SHEET_STATUS_LABELS,
  type GradeSheet,
  type GradeSheetStatus,
} from '@/lib/domain';

interface Page { items: GradeSheet[]; total: number }

export default function GradeSheetsPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'ANA']}>
      <GradeSheetsList />
    </Protected>
  );
}

function GradeSheetsList() {
  const { hasRole, user } = useAuth();
  const canCreate = hasRole(['ADM', 'TEA']);
  const [data, setData] = useState<Page | null>(null);
  const [status, setStatus] = useState<GradeSheetStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<Page>('/api/grades/sheets', {
        query: {
          status: status || undefined,
          // TEA видит только свои ведомости (если не ADM/ANA)
          teacherId: hasRole(['ADM', 'ANA']) ? undefined : user?.id,
          limit: 100,
        },
      });
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, hasRole, user?.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ведомости</h1>
          {data && <p className="text-sm text-slate-500">Всего: {data.total}</p>}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GradeSheetStatus | '')}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Все</option>
            {(Object.keys(GRADE_SHEET_STATUS_LABELS) as GradeSheetStatus[]).map((s) => (
              <option key={s} value={s}>{GRADE_SHEET_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              {showForm ? 'Отмена' : 'Создать ведомость'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && <CreateSheetForm onDone={() => { setShowForm(false); void load(); }} />}

      {!data ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Дата</th>
                <th className="px-4 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/grades/${s.id}`} className="text-blue-700 hover:underline">
                      {s.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{fmtDate(s.date)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${GRADE_SHEET_STATUS_COLORS[s.status]}`}>
                      {GRADE_SHEET_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Нет ведомостей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateSheetForm({ onDone }: { onDone: () => void }) {
  const [groupId, setGroupId] = useState('');
  const [curriculumEntryId, setCurriculumEntryId] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiFetch('/api/grades/sheets', {
        method: 'POST',
        body: { groupId, curriculumEntryId, date },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md bg-slate-50 p-4 ring-1 ring-slate-200 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="block text-sm">
        ID группы
        <input value={groupId} onChange={(e) => setGroupId(e.target.value)} required
          placeholder="UUID группы"
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <label className="block text-sm">
        ID записи учебного плана
        <input value={curriculumEntryId} onChange={(e) => setCurriculumEntryId(e.target.value)} required
          placeholder="UUID curriculum_entry"
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <label className="block text-sm">
        Дата проведения
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      {err && <div className="sm:col-span-3 rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <div className="sm:col-span-3 flex justify-end">
        <button disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Создаём…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}
