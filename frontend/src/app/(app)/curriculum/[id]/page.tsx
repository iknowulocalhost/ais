'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  CONTROL_FORM_LABELS,
  CURRICULUM_PLAN_STATUS_LABELS,
  type ControlForm,
  type CurriculumEntry,
  type CurriculumPlan,
  type CurriculumPlanStatus,
  type Discipline,
} from '@/lib/domain';

const PLAN_STATUS_VARIANT: Record<CurriculumPlanStatus, string> = {
  DRAFT: '',
  ACTIVE: 'badge--ok',
  ARCHIVED: 'badge--bad',
};

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
      setError(explainError(e).hint);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const discMap = new Map(disciplines.map((d) => [d.id, d]));

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
      alert(explainError(e).hint);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm('Удалить запись из плана?')) return;
    try {
      await apiFetch(`/api/curriculum/plans/${id}/entries/${entryId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(explainError(e).hint);
    }
  }

  if (error) return <div className="callout callout--danger"><span>{error}</span></div>;
  if (!plan) return <div className="muted">Загрузка…</div>;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--s-4)' }}>
          <div className="col" style={{ gap: 'var(--s-1)' }}>
            <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>{plan.name}</h1>
            <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
              Программа: {plan.programCode} · Год: <span className="tnum">{plan.admissionYear}</span>
            </p>
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span className={`badge ${PLAN_STATUS_VARIANT[plan.status]}`}>
              {CURRICULUM_PLAN_STATUS_LABELS[plan.status]}
            </span>
            {canEdit && plan.status === 'DRAFT' && (
              <button onClick={() => doAction('activate')} className="btn btn--primary btn--sm">
                Активировать
              </button>
            )}
            {canEdit && plan.status === 'ACTIVE' && (
              <button onClick={() => doAction('archive')} className="btn btn--danger btn--sm">
                В архив
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-20)' }}>
            Дисциплины <span className="mono muted tnum">({entries.length})</span>
          </h2>
          {canEdit && plan.status !== 'ARCHIVED' && (
            <button onClick={() => setShowAdd((v) => !v)} className="btn btn--primary btn--sm">
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
          <p className="muted" style={{ marginTop: 'var(--s-3)' }}>Записей пока нет — добавьте дисциплины.</p>
        ) : (
          semesters.map((sem) => (
            <div key={sem} style={{ marginTop: 'var(--s-4)' }}>
              <h3 className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)', marginBottom: 'var(--s-2)' }}>
                Семестр {sem}
              </h3>
              <div className="card card--bleed">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Дисциплина</th>
                      <th>Форма контроля</th>
                      <th style={{ textAlign: 'right' }}>Часы</th>
                      {canEdit && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bySemester.get(sem)!.map((entry) => {
                      const disc = discMap.get(entry.disciplineId);
                      return (
                        <tr key={entry.id}>
                          <td className="mono muted">{disc?.code ?? '—'}</td>
                          <td>{disc?.name ?? entry.disciplineId}</td>
                          <td>{CONTROL_FORM_LABELS[entry.controlForm]}</td>
                          <td className="tnum" style={{ textAlign: 'right' }}>{entry.hours}</td>
                          {canEdit && (
                            <td style={{ textAlign: 'right' }}>
                              <button onClick={() => deleteEntry(entry.id)} className="btn btn--danger btn--sm">
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
        marginTop: 'var(--s-3)',
        padding: 'var(--s-4)',
        background: 'var(--ais-sub)',
        border: '1px solid var(--ais-line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <label className="field">
        <span className="field__label">Дисциплина</span>
        <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className="input">
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Семестр</span>
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Форма контроля</span>
        <select value={controlForm} onChange={(e) => setControlForm(e.target.value as ControlForm)} className="input">
          {(Object.keys(CONTROL_FORM_LABELS) as ControlForm[]).map((cf) => (
            <option key={cf} value={cf}>{CONTROL_FORM_LABELS[cf]}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Часы</span>
        <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} required min={1} className="input" />
      </label>
      {err && <div className="callout callout--danger" style={{ gridColumn: '1 / -1' }}><span>{err}</span></div>}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={busy} className="btn btn--primary">
          {busy ? 'Добавляем…' : 'Добавить'}
        </button>
      </div>
    </form>
  );
}
