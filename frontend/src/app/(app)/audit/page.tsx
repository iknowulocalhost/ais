'use client';

import { useEffect, useState } from 'react';
import { Search, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';

interface AuditEntry {
  ts: string;
  actorId: string | null;
  actor: { email: string; name: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
}

interface ListResponse {
  total: number;
  items: AuditEntry[];
}

const ACTIONS = [
  '', 'HTTP_REQUEST', 'CREATE', 'UPDATE', 'DELETE',
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE',
  'ROLE_CHANGE', 'READ_SENSITIVE',
];

export default function AuditPage() {
  const { hasRole } = useAuth();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!hasRole(['SUPERADMIN'])) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<ListResponse>('/api/audit', {
      query: {
        from: from || undefined,
        to: to || undefined,
        actorId: actorId || undefined,
        action: action || undefined,
        entity: entity || undefined,
        search: search || undefined,
        limit,
        offset,
      },
    })
      .then((res) => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, actorId, action, entity, search, limit, offset, tick, hasRole]);

  if (!hasRole(['SUPERADMIN'])) {
    return (
      <div className="col" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--s-7)', gap: 'var(--s-3)', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-22)' }}>Недостаточно прав</h1>
        <p className="muted" style={{ fontSize: 'var(--fs-14)' }}>Журнал аудита доступен только супер-администратору.</p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 1200 }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            администрация · безопасность
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
            Журнал аудита
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-14)' }}>
            Записей: <span className="mono tnum">{total}</span> · показано {items.length}
          </p>
        </div>
        <button type="button" className="btn btn--outline" onClick={() => setTick((t) => t + 1)}>
          <RefreshCw size={14} strokeWidth={1.75} /> Обновить
        </button>
      </header>

      <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--s-3)' }}>
          <Field label="С">
            <input type="datetime-local" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} />
          </Field>
          <Field label="По">
            <input type="datetime-local" className="input" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} />
          </Field>
          <Field label="Action">
            <select className="select" value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}>
              {ACTIONS.map((a) => <option key={a} value={a}>{a || 'все'}</option>)}
            </select>
          </Field>
          <Field label="Entity">
            <input className="input" placeholder="Request, User, Applicant…" value={entity} onChange={(e) => { setEntity(e.target.value); setOffset(0); }} />
          </Field>
          <Field label="Actor ID (UUID)">
            <input className="input mono" value={actorId} onChange={(e) => { setActorId(e.target.value); setOffset(0); }} />
          </Field>
          <Field label="Поиск">
            <div className="input-group">
              <Search size={14} className="icon" />
              <input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} style={{ padding: '8px 12px 8px 0' }} />
            </div>
          </Field>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', borderColor: 'var(--ais-ember)', color: 'var(--ais-ember)' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div className="muted" style={{ padding: 'var(--s-5)', fontSize: 'var(--fs-13)' }}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--ais-bone-3)' }}>
            <ShieldAlert size={28} strokeWidth={1.5} />
            <span style={{ fontSize: 'var(--fs-13)' }}>Записи не найдены</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-12)' }}>
            <thead>
              <tr style={{ background: 'var(--ais-paper-2)', textAlign: 'left' }}>
                <th style={th}>Время</th>
                <th style={th}>Action</th>
                <th style={th}>Entity</th>
                <th style={th}>Кто</th>
                <th style={th}>Детали</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--ais-line)' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }} className="mono tnum">
                    {new Date(e.ts).toLocaleString('ru-RU')}
                  </td>
                  <td style={td}>
                    <span className="badge" style={{ fontSize: 11 }}>{e.action}</span>
                  </td>
                  <td style={td}>
                    {e.entity}{e.entityId ? <span className="muted mono" style={{ fontSize: 11 }}> · {e.entityId.slice(0, 8)}</span> : null}
                  </td>
                  <td style={td}>
                    {e.actor ? (
                      <span>
                        <span style={{ color: 'var(--ais-bone)' }}>{e.actor.name || e.actor.email}</span>
                        {e.ipAddress && (
                          <span className="muted mono" style={{ fontSize: 11 }}> ({e.ipAddress})</span>
                        )}
                      </span>
                    ) : (
                      <span className="mono" style={{ color: 'var(--ais-bone-3)' }}>{e.ipAddress ?? '—'}</span>
                    )}
                  </td>
                  <td style={{ ...td, maxWidth: 380 }}>
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--ais-bone-3)', fontSize: 11 }}>{summarizeMeta(e.meta)}</summary>
                      <pre style={{ margin: '6px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--ais-bone-3)' }}>
                        {JSON.stringify({ meta: e.meta, ua: e.userAgent }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost btn--sm" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
          ← Предыдущие
        </button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={offset + items.length >= total || loading} onClick={() => setOffset((o) => o + limit)}>
          Следующие →
        </button>
      </div>
    </div>
  );
}

function summarizeMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return '—';
  if (typeof meta.method === 'string' && typeof meta.path === 'string') {
    return `${meta.method} ${meta.path} → ${meta.status ?? '?'} (${meta.durationMs ?? '?'} мс)`;
  }
  return JSON.stringify(meta).slice(0, 120);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="col" style={{ gap: 4, fontSize: 'var(--fs-12)', color: 'var(--ais-bone-3)' }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {children}
    </label>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--ais-bone-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
