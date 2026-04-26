'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  fmtDate,
  GRADE_SHEET_STATUS_LABELS,
  type GradeSheet,
  type GradeSheetStatus,
} from '@/lib/domain';

interface Page { items: GradeSheet[]; total: number }

const SHEET_STATUS_VARIANT: Record<GradeSheetStatus, string> = {
  OPEN: 'badge--warn',
  CLOSED: 'badge--ok',
};

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
          teacherId: hasRole(['ADM', 'ANA']) ? undefined : user?.id,
          limit: 100,
        },
      });
      setData(d);
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [status, hasRole, user?.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 'var(--s-1)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Ведомости</h1>
          {data && <p className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>Всего: <span className="tnum">{data.total}</span></p>}
        </div>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GradeSheetStatus | '')}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="">Все</option>
            {(Object.keys(GRADE_SHEET_STATUS_LABELS) as GradeSheetStatus[]).map((s) => (
              <option key={s} value={s}>{GRADE_SHEET_STATUS_LABELS[s]}</option>
            ))}
          </select>
          {canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn btn--primary btn--sm"
            >
              {showForm ? 'Отмена' : 'Создать ведомость'}
            </button>
          )}
        </div>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {showForm && <CreateSheetForm onDone={() => { setShowForm(false); void load(); }} />}

      {!data ? (
        <div className="muted">Загрузка…</div>
      ) : (
        <div className="card card--bleed">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/grades/${s.id}`} className="mono" style={{ color: 'var(--ais-forest-hi)' }}>
                      {s.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="mono muted">{fmtDate(s.date)}</td>
                  <td>
                    <span className={`badge ${SHEET_STATUS_VARIANT[s.status]}`}>
                      {GRADE_SHEET_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 'var(--s-6)' }}>
                    Нет ведомостей
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
      setErr(explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s-3)' }}>
      <label className="field">
        <span className="field__label">ID группы</span>
        <input value={groupId} onChange={(e) => setGroupId(e.target.value)} required
          placeholder="UUID группы" className="input" />
      </label>
      <label className="field">
        <span className="field__label">ID записи учебного плана</span>
        <input value={curriculumEntryId} onChange={(e) => setCurriculumEntryId(e.target.value)} required
          placeholder="UUID curriculum_entry" className="input" />
      </label>
      <label className="field">
        <span className="field__label">Дата проведения</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
          className="input" />
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
