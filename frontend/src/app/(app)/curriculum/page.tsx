'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  CURRICULUM_PLAN_STATUS_LABELS,
  type CurriculumPlan,
  type CurriculumPlanStatus,
} from '@/lib/domain';

interface Page { items: CurriculumPlan[]; total: number }

const PLAN_STATUS_VARIANT: Record<CurriculumPlanStatus, string> = {
  DRAFT: '',
  ACTIVE: 'badge--ok',
  ARCHIVED: 'badge--bad',
};

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
      setError(explainError(e).hint);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 'var(--s-1)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Учебные планы</h1>
          {data && <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>Всего: <span className="tnum">{data.total}</span></p>}
        </div>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CurriculumPlanStatus | '')}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="">Все статусы</option>
            {(Object.keys(CURRICULUM_PLAN_STATUS_LABELS) as CurriculumPlanStatus[]).map((s) => (
              <option key={s} value={s}>{CURRICULUM_PLAN_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {canCreate && (
            <button onClick={() => setShowForm((v) => !v)} className="btn btn--primary btn--sm">
              {showForm ? 'Отмена' : 'Создать план'}
            </button>
          )}
        </div>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {showForm && <CreatePlanForm onDone={() => { setShowForm(false); void load(); }} />}

      {!data ? (
        <div className="muted">Загрузка…</div>
      ) : (
        <div className="card card--bleed">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Программа</th>
                <th>Год набора</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/curriculum/${p.id}`} style={{ color: 'var(--ais-forest-hi)' }}>
                      {p.name}
                    </Link>
                  </td>
                  <td className="mono">{p.programCode}</td>
                  <td className="mono tnum">{p.admissionYear}</td>
                  <td>
                    <span className={`badge ${PLAN_STATUS_VARIANT[p.status]}`}>
                      {CURRICULUM_PLAN_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 'var(--s-6)' }}>
                    Нет учебных планов
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
      setErr(explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s-3)' }}>
      <label className="field">
        <span className="field__label">Код программы</span>
        <input value={programCode} onChange={(e) => setProgramCode(e.target.value)} required
          placeholder="09.02.07" className="input" />
      </label>
      <label className="field">
        <span className="field__label">Год набора</span>
        <input type="number" value={admissionYear} onChange={(e) => setAdmissionYear(e.target.value)} required
          className="input" />
      </label>
      <label className="field">
        <span className="field__label">Название</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          placeholder="УП 09.02.07 набор 2024" className="input" />
      </label>
      {err && <div className="callout callout--danger" style={{ gridColumn: '1 / -1' }}><span>{err}</span></div>}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={busy} className="btn btn--primary">
          {busy ? 'Создаём…' : 'Создать'}
        </button>
      </div>
    </form>
  );
}
