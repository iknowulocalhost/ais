'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { GRADE_VALUE_LABELS, type Grade } from '@/lib/domain';

const GRADE_CLASS: Record<number, string> = {
  0: 'grade grade--n',
  1: 'grade grade--3',
  2: 'grade grade--2',
  3: 'grade grade--3',
  4: 'grade grade--4',
  5: 'grade grade--5',
};

export function StudentGrades({ studentId }: { studentId: string }) {
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const g = await apiFetch<Grade[]>(`/api/grades/students/${studentId}`);
      setGrades(g);
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  const numericGrades = (grades ?? []).filter((g) => g.value !== null && g.value >= 2);
  const avg = numericGrades.length > 0
    ? (numericGrades.reduce((sum, g) => sum + g.value!, 0) / numericGrades.length).toFixed(2)
    : null;

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col" style={{ gap: 'var(--s-1)' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-20)' }}>Зачётная книжка</h2>
          {avg && (
            <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
              Средний балл: <span className="tnum" style={{ color: 'var(--ais-bone)' }}>{avg}</span>
            </p>
          )}
        </div>
      </div>

      {error && <div className="callout callout--danger" style={{ marginTop: 'var(--s-3)' }}><span>{error}</span></div>}

      <div className="card card--bleed" style={{ marginTop: 'var(--s-3)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Ведомость</th>
              <th>Оценка</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {(grades ?? []).map((g) => (
              <tr key={g.id}>
                <td className="mono muted">{g.sheetId.slice(0, 8)}…</td>
                <td>
                  {g.value !== null ? (
                    <span className={GRADE_CLASS[g.value]}>
                      {g.value} · {GRADE_VALUE_LABELS[g.value] ?? ''}
                    </span>
                  ) : (
                    <span className="muted">Не выставлена</span>
                  )}
                </td>
                <td className="muted">{g.comment ?? '—'}</td>
              </tr>
            ))}
            {grades && grades.length === 0 && (
              <tr>
                <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 'var(--s-5)' }}>
                  Оценок пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
