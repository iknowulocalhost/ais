'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  CONTROL_FORM_LABELS,
  CURRICULUM_PLAN_STATUS_COLORS,
  CURRICULUM_PLAN_STATUS_LABELS,
  type ControlForm,
  type CurriculumEntry,
  type CurriculumPlan,
  type Discipline,
} from '@/lib/domain';

export default function CurriculumDetailPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'ANA']}>
      <CurriculumDetail />
    </Protected>
  );
}

function CurriculumDetail() {
  const { hasRole } = useAuth();
  const canEdit = hasRole(['ADM']);
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [plan, setPlan] = useState<CurriculumPlan | null>(null);
  const [entries, setEntries] = useState<CurriculumEntry[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, e, d] = await Promise.all([
        apiFetch<CurriculumPlan>(`/api/curriculum/plans/${id}`),
        apiFetch<CurriculumEntry[]>(`/api/curriculum/plans/${id}/entries`),
        apiFetch<{ items: Discipline[] }>('/api/curriculum/disciplines', { query: { limit: 500 } }),
      ]);
      setPlan(p);
      setEntries(e);
      setDisciplines(d.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const discMap = new Map(disciplines.map((d) => [d.id, d]));

  // Группируем записи по семестрам
  const bySemester = new Map<number, CurriculumEntry[]>();
  for (const e of entries) {
    const arr = bySemester.get(e.semester) ?? [];
    arr.push(e);
    bySemester.set(e.semester, arr);
  }
  const semesters = [...bySemester.keys()].sort((a, b) => a - b);

  async function doAction(action: 'activate' | 'archive') {
    try {
      await apiFetch(`/api/curriculum/plans/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm('Удалить запись из плана?')) return;
    try {
      await apiFetch(`/api/curriculum/plans/${id}/entries/${entryId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (error) return <div className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!plan) return <div className="text-slate-500">Загрузка…</div>;

  return (
    <div className="space-y-6">
      <header className="rounded-lg bg-white p-6 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{plan.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Программа: {plan.programCode} · Год: {plan.admissionYear}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm ${CURRICULUM_PLAN_STATUS_COLORS[plan.status]}`}>
              {CURRICULUM_PLAN_STATUS_LABELS[plan.status]}
            </span>
            {canEdit && plan.status === 'DRAFT' && (
              <button onClick={() => doAction('activate')}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700">
                Активировать
              </button>
            )}
            {canEdit && plan.status === 'ACTIVE' && (
              <button onClick={() => doAction('archive')}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-700">
                В архив
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Дисциплины ({entries.length})
          </h2>
          {canEdit && plan.status !== 'ARCHIVED' && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              {showAdd ? 'Отмена' : 'Добавить'}
            </button>
          )}
        </div>

        {showAdd && (
          <AddEntryForm
            planId={id}
            disciplines={disciplines}
            onDone={() => { setShowAdd(false); void load(); }}
          />
        )}

        {semesters.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Записей пока нет — добавьте дисциплины.</p>
        ) : (
          semesters.map((sem) => (
            <div key={sem} className="mt-4">
              <h3 className="text-sm font-semibold text-slate-600">Семестр {sem}</h3>
              <div className="mt-1 overflow-hidden rounded-md ring-1 ring-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Код</th>
                      <th className="px-3 py-2 font-medium">Дисциплина</th>
                      <th className="px-3 py-2 font-medium">Форма контроля</th>
                      <th className="px-3 py-2 text-right font-medium">Часы</th>
                      {canEdit && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bySemester.get(sem)!.map((entry) => {
                      const disc = discMap.get(entry.disciplineId);
                      return (
                        <tr key={entry.id}>
                          <td className="px-3 py-2 text-slate-500">{disc?.code ?? '—'}</td>
                          <td className="px-3 py-2">{disc?.name ?? entry.disciplineId}</td>
                          <td className="px-3 py-2">{CONTROL_FORM_LABELS[entry.controlForm]}</td>
                          <td className="px-3 py-2 text-right">{entry.hours}</td>
                          {canEdit && (
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="text-xs text-rose-700 hover:underline"
                              >
                                Удалить
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function AddEntryForm({
  planId,
  disciplines,
  onDone,
}: {
  planId: string;
  disciplines: Discipline[];
  onDone: () => void;
}) {
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.id ?? '');
  const [semester, setSemester] = useState('1');
  const [controlForm, setControlForm] = useState<ControlForm>('EXAM');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiFetch(`/api/curriculum/plans/${planId}/entries`, {
        method: 'POST',
        body: { disciplineId, semester: Number(semester), controlForm, hours: Number(hours) },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 rounded-md bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-4">
      <label className="block text-sm">
        Дисциплина
        <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1">
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Семестр
        <select value={semester} onChange={(e) => setSemester(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Форма контроля
        <select value={controlForm} onChange={(e) => setControlForm(e.target.value as ControlForm)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1">
          {(Object.keys(CONTROL_FORM_LABELS) as ControlForm[]).map((cf) => (
            <option key={cf} value={cf}>{CONTROL_FORM_LABELS[cf]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Часы
        <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} required min={1}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1" />
      </label>
      {err && <div className="sm:col-span-4 rounded bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <div className="sm:col-span-4 flex justify-end">
        <button disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Добавляем…' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}
