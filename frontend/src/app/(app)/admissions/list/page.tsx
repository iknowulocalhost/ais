'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FolderOpen, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';

type Status = 'DRAFT' | 'SUBMITTED' | 'ENROLLED' | 'REJECTED';

interface ApplicantSummary {
  id: string;
  status: Status;
  lastName: string;
  firstName: string;
  middleName: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  total: number;
  items: ApplicantSummary[];
}

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'черновик',
  SUBMITTED: 'подана',
  ENROLLED: 'зачислен',
  REJECTED: 'отклонён',
};

export default function AdmissionsListPage() {
  const { hasRole } = useAuth();
  const [items, setItems] = useState<ApplicantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | ''>('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!hasRole(['SUPERADMIN', 'COM'])) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<ListResponse>('/api/admissions', {
      query: { status: status || undefined, limit: 100, offset: 0 },
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить реестр');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, hasRole]);

  if (!hasRole(['SUPERADMIN', 'COM'])) {
    return (
      <div className="col" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--s-7)', gap: 'var(--s-3)', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-22)' }}>Недостаточно прав</h1>
        <p className="muted" style={{ fontSize: 'var(--fs-14)' }}>
          Реестр личных дел абитуриентов доступен только администратору.
        </p>
      </div>
    );
  }

  const q = query.trim().toLocaleLowerCase('ru');
  const filtered = q
    ? items.filter((a) =>
        `${a.lastName} ${a.firstName} ${a.middleName ?? ''}`.toLocaleLowerCase('ru').includes(q),
      )
    : items;

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 1040 }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            учебная часть · приёмная комиссия
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
            Реестр абитуриентов
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-14)' }}>
            Всего записей: <span className="mono tnum">{total}</span>
          </p>
        </div>
        <Link href="/admissions" className="btn btn--outline">
          <ArrowLeft size={14} strokeWidth={1.75} /> К форме
        </Link>
      </header>

      <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: 1, minWidth: 240 }}>
          <Search size={14} className="icon" />
          <input
            className="input"
            placeholder="Поиск по ФИО"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: '8px 12px 8px 0', fontSize: 'var(--fs-13)' }}
          />
        </div>
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | '')}
          style={{ maxWidth: 220 }}
        >
          <option value="">все статусы</option>
          <option value="DRAFT">черновик</option>
          <option value="SUBMITTED">подана</option>
          <option value="ENROLLED">зачислен</option>
          <option value="REJECTED">отклонён</option>
        </select>
      </div>

      {error && (
        <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', borderColor: 'var(--ais-ember)', color: 'var(--ais-ember)' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="muted" style={{ padding: 'var(--s-5)', fontSize: 'var(--fs-13)' }}>Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--ais-bone-3)' }}>
            <FolderOpen size={28} strokeWidth={1.5} />
            <span style={{ fontSize: 'var(--fs-13)' }}>Записи не найдены</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
            <thead>
              <tr style={{ background: 'var(--ais-paper-2)', textAlign: 'left' }}>
                <th style={th}>ФИО</th>
                <th style={th}>Статус</th>
                <th style={th}>Создана</th>
                <th style={{ ...th, width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--ais-line)' }}>
                  <td style={td}>
                    {a.lastName} {a.firstName} {a.middleName ?? ''}
                  </td>
                  <td style={td}>
                    <span className={`badge ${a.status === 'ENROLLED' ? 'badge--ok' : a.status === 'REJECTED' ? 'badge--err' : ''}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td style={{ ...td, color: 'var(--ais-bone-3)' }} className="mono tnum">
                    {new Date(a.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td style={td}>
                    <Link href={`/admissions/${a.id}`} className="btn btn--ghost btn--sm">
                      Личное дело →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 14px',
  fontWeight: 600,
  fontSize: 'var(--fs-12)',
  color: 'var(--ais-bone-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const td: React.CSSProperties = { padding: '12px 14px' };
