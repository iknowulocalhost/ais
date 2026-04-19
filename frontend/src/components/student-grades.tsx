'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GRADE_VALUE_LABELS, type Grade } from '@/lib/domain';

export function StudentGrades({ studentId }: { studentId: string }) {
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const g = await apiFetch<Grade[]>(`/api/grades/students/${studentId}`);
      setGrades(g);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  // Средний балл (без зачётов — только 2-5)
  const numericGrades = (grades ?? []).filter((g) => g.value !== null && g.value >= 2);
  const avg = numericGrades.length > 0
    ? (numericGrades.reduce((sum, g) => sum + g.value!, 0) / numericGrades.length).toFixed(2)
    : null;

  return (
    <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Зачётная книжка</h2>
          {avg && (
            <p className="text-sm text-slate-500">
              Средний балл: <span className="font-medium text-slate-800">{avg}</span>
            </p>
          )}
        </div>
      </div>

      {error && <div className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="mt-3 overflow-hidden rounded-md ring-1 ring-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Ведомость</th>
              <th className="px-3 py-2 font-medium">Оценка</th>
              <th className="px-3 py-2 font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(grades ?? []).map((g) => (
              <tr key={g.id}>
                <td className="px-3 py-2 text-slate-500">{g.sheetId.slice(0, 8)}…</td>
                <td className="px-3 py-2">
                  {g.value !== null ? (
                    <span className="font-medium">
                      {g.value} — {GRADE_VALUE_LABELS[g.value] ?? ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">Не выставлена</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{g.comment ?? '—'}</td>
              </tr>
            ))}
            {grades && grades.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">Оценок пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
