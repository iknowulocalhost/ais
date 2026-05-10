'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  fmtDate,
  GRADE_SHEET_STATUS_LABELS,
  GRADE_VALUE_LABELS,
  type Grade,
  type GradeSheet,
  type GradeSheetStatus,
} from '@/lib/domain';

const SHEET_STATUS_VARIANT: Record<GradeSheetStatus, string> = {
  OPEN: 'badge--warn',
  CLOSED: 'badge--ok',
};

const GRADE_CLASS: Record<number, string> = {
  0: 'grade grade--n',
  1: 'grade grade--3',
  2: 'grade grade--2',
  3: 'grade grade--3',
  4: 'grade grade--4',
  5: 'grade grade--5',
};

export default function GradeSheetDetailPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'ADMINISTRATION', 'STU']}>
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
      setError(explainError(e).hint);
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
      setError(explainError(e).hint);
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
      alert(explainError(e).hint);
    }
  }

  if (error && !sheet) return <div className="callout callout--danger"><span>{error}</span></div>;
  if (!sheet) return <div className="muted">Загрузка…</div>;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--s-4)' }}>
          <div className="col" style={{ gap: 'var(--s-1)' }}>
            <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Ведомость</h1>
            <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
              Дата: {fmtDate(sheet.date)} · ID: {sheet.id.slice(0, 8)}…
            </p>
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span className={`badge ${SHEET_STATUS_VARIANT[sheet.status]}`}>
              {GRADE_SHEET_STATUS_LABELS[sheet.status]}
            </span>
            {canClose && (
              <button onClick={closeSheet} className="btn btn--primary btn--sm">
                Закрыть ведомость
              </button>
            )}
          </div>
        </div>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-20)' }}>
            Оценки <span className="mono muted tnum">({grades.length})</span>
          </h2>
          {canSubmit && editing.size > 0 && (
            <button
              onClick={() => void submitGrades()}
              disabled={saving}
              className="btn btn--primary btn--sm"
            >
              {saving ? 'Сохраняем…' : `Сохранить (${editing.size})`}
            </button>
          )}
        </div>

        <div className="card card--bleed" style={{ marginTop: 'var(--s-3)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Оценка</th>
                <th>Комментарий</th>
                {canSubmit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => {
                const ed = editing.get(g.id);
                return (
                  <tr key={g.id}>
                    <td className="mono muted">{g.studentId.slice(0, 8)}…</td>
                    <td>
                      {ed ? (
                        <select
                          value={ed.value}
                          onChange={(e) => updateEdit(g.id, 'value', e.target.value)}
                          className="input"
                          style={{ width: 'auto' }}
                        >
                          <option value="">—</option>
                          {[0, 1, 2, 3, 4, 5].map((v) => (
                            <option key={v} value={v}>{v} — {GRADE_VALUE_LABELS[v]}</option>
                          ))}
                        </select>
                      ) : g.value !== null ? (
                        <span className={GRADE_CLASS[g.value]}>
                          {g.value} · {GRADE_VALUE_LABELS[g.value] ?? ''}
                        </span>
                      ) : (
                        <span className="muted">Не выставлена</span>
                      )}
                    </td>
                    <td className="muted">
                      {ed ? (
                        <input
                          value={ed.comment}
                          onChange={(e) => updateEdit(g.id, 'comment', e.target.value)}
                          className="input"
                          placeholder="Комментарий"
                        />
                      ) : (
                        g.comment ?? '—'
                      )}
                    </td>
                    {canSubmit && (
                      <td style={{ textAlign: 'right' }}>
                        {!ed ? (
                          <button onClick={() => startEdit(g)} className="btn btn--ghost btn--sm">
                            Редактировать
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditing((prev) => { const n = new Map(prev); n.delete(g.id); return n; })}
                            className="btn btn--ghost btn--sm"
                          >
                            Отмена
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {grades.length === 0 && (
                <tr>
                  <td colSpan={canSubmit ? 4 : 3} className="muted" style={{ textAlign: 'center', padding: 'var(--s-6)' }}>
                    Нет студентов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
