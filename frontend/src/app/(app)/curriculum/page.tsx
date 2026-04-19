'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  CURRICULUM_PLAN_STATUS_COLORS,
  CURRICULUM_PLAN_STATUS_LABELS,
  type CurriculumPlan,
  type CurriculumPlanStatus,
} from '@/lib/domain';

interface Page { items: CurriculumPlan[]; total: number }

export default function CurriculumPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'ANA']}>
      <CurriculumList />
    </Protected>
  );
}

function CurriculumList() {
  const { hasRole } = useAuth();
  const canCreate = hasRole(['ADM']);
  const [data, setData] = useState<Page | null>(null);
  const [status, setStatus] = useState<CurriculumPlanStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<Page>('/api/curriculum/plans', {
        query: { status: status || undefined, limit: 100 },
      });
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Учебные планы</h1>
          {data && <p className="text-sm text-slate-500">Всего: {data.total}</p>}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CurriculumPlanStatus | '')}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Все статусы</option>
            {(Object.keys(CURRICULUM_PLAN_STATUS_LABELS) as CurriculumPlanStatus[]).map((s) => (
              <option key={s} value={s}>{CURRICULUM_PLAN_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              {showForm ? 'Отмена' : 'Создать план'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && <CreatePlanForm onDone={() => { setShowForm(false); void load(); }} />}

      {!data ? (
        <div className="text-slate-500">Загрузка…</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Название</th>
                <th className="px-4 py-2 font-medium">Программа</th>
                <th className="px-4 py-2 font-medium">Год набора</th>
                <th className="px-4 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/curriculum/${p.id}`} className="text-blue-700 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{p.programCode}</td>
                  <td className="px-4 py-2 text-slate-700">{p.admissionYear}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${CURRICULUM_PLAN_STATUS_COLORS[p.status]}`}>
                      {CURRICULUM_PLAN_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Нет учебных планов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreatePlanForm({ onDone }: { onDone: () => void }) {
  const [programCode, setProgramCode] = useState('');
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear().toString());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiFetch('/api/curriculum/plans', {
        method: 'POST',
        body: { programCode, admissionYear: Number(admissionYear), name },
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
        Код программы
        <input value={programCode} onChange={(e) => setProgramCode(e.target.value)} required
          placeholder="09.02.07"
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <label className="block text-sm">
        Год набора
        <input type="number" value={admissionYear} onChange={(e) => setAdmissionYear(e.target.value)} required
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      <label className="block text-sm">
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} required
          placeholder="УП 09.02.07 набор 2024"
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
