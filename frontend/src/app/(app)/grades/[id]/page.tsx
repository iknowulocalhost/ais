'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  fmtDate,
  GRADE_SHEET_STATUS_COLORS,
  GRADE_SHEET_STATUS_LABELS,
  GRADE_VALUE_LABELS,
  type Grade,
  type GradeSheet,
} from '@/lib/domain';

export default function GradeSheetDetailPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'ANA', 'STU']}>
      <GradeSheetDetail />
    </Protected>
  );
}

function GradeSheetDetail() {
  const { hasRole, user } = useAuth();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [sheet, setSheet] = useState<GradeSheet | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Map<string, { value: string; comment: string }>>(new Map());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, g] = await Promise.all([
        apiFetch<GradeSheet>(`/api/grades/sheets/${id}`),
        apiFetch<Grade[]>(`/api/grades/sheets/${id}/grades`),
      ]);
      setSheet(s);
      setGrades(g);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const isTeacherOwner = sheet && user && sheet.teacherId === user.id;
  const canSubmit = (hasRole(['TEA']) && isTeacherOwner) && sheet?.status === 'OPEN';
  const canClose = (isTeacherOwner || hasRole(['ADM'])) && sheet?.status === 'OPEN';

  function startEdit(grade: Grade) {
    setEditing((prev) => {
      const next = new Map(prev);
      next.set(grade.id, {
        value: grade.value?.toString() ?? '',
        comment: grade.comment ?? '',
      });
      return next;
    });
  }

  function updateEdit(gradeId: string, field: 'value' | 'comment', val: string) {
    setEditing((prev) => {
      const next = new Map(prev);
      const cur = next.get(gradeId);
      if (cur) next.set(gradeId, { ...cur, [field]: val });
      return next;
    });
  }

  async function submitGrades() {
    if (editing.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const gradesPayload = [...editing.entries()].map(([gradeId, { value, comment }]) => ({
        gradeId,
        value: Number(value),
        comment: comment || undefined,
      }));
      await apiFetch(`/api/grades/sheets/${id}/submit`, {
        method: 'POST',
        body: { grades: gradesPayload },
      });
      setEditing(new Map());
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function closeSheet() {
    if (!window.confirm('Закрыть ведомость? После закрытия изменения невозможны.')) return;
    try {
      await apiFetch(`/api/grades/sheets/${id}/close`, { method: 'POST' });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (error && !sheet) return <div className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!sheet) return <div className="text-slate-500">Загрузка…</div>;

  return (
    <div className="space-y-6">
      <header className="rounded-lg bg-white p-6 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Ведомость</h1>
            <p className="mt-1 text-sm text-slate-500">
              Дата: {fmtDate(sheet.date)} · ID: {sheet.id.slice(0, 8)}…
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm ${GRADE_SHEET_STATUS_COLORS[sheet.status]}`}>
              {GRADE_SHEET_STATUS_LABELS[sheet.status]}
            </span>
            {canClose && (
              <button onClick={closeSheet}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700">
                Закрыть ведомость
              </button>
            )}
          </div>
        </div>
      </header>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Оценки ({grades.length})</h2>
          {canSubmit && editing.size > 0 && (
            <button
              onClick={() => void submitGrades()}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохраняем…' : `Сохранить (${editing.size})`}
            </button>
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-md ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Студент</th>
                <th className="px-3 py-2 font-medium">Оценка</th>
                <th className="px-3 py-2 font-medium">Комментарий</th>
                {canSubmit && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grades.map((g) => {
                const ed = editing.get(g.id);
                return (
                  <tr key={g.id}>
                    <td className="px-3 py-2 text-slate-700">{g.studentId.slice(0, 8)}…</td>
                    <td className="px-3 py-2">
                      {ed ? (
                        <select
                          value={ed.value}
                          onChange={(e) => updateEdit(g.id, 'value', e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-0.5 text-sm"
                        >
                          <option value="">—</option>
                          {[0, 1, 2, 3, 4, 5].map((v) => (
                            <option key={v} value={v}>{v} — {GRADE_VALUE_LABELS[v]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={g.value !== null ? 'font-medium' : 'text-slate-400'}>
                          {g.value !== null ? `${g.value} — ${GRADE_VALUE_LABELS[g.value] ?? ''}` : 'Не выставлена'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {ed ? (
                        <input
                          value={ed.comment}
                          onChange={(e) => updateEdit(g.id, 'comment', e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-0.5 text-sm"
                          placeholder="Комментарий"
                        />
                      ) : (
                        g.comment ?? '—'
                      )}
                    </td>
                    {canSubmit && (
                      <td className="px-3 py-2 text-right">
                        {!ed ? (
                          <button onClick={() => startEdit(g)}
                            className="text-xs text-blue-700 hover:underline">
                            Редактировать
                          </button>
                        ) : (
                          <button onClick={() => setEditing((prev) => { const n = new Map(prev); n.delete(g.id); return n; })}
                            className="text-xs text-slate-500 hover:underline">
                            Отмена
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {grades.length === 0 && (
                <tr><td colSpan={canSubmit ? 4 : 3} className="px-3 py-4 text-center text-slate-500">Нет студентов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
