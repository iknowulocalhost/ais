'use client';

import { useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import type { AuthUser } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

interface UsersPage {
  total: number;
  items: AuthUser[];
}

export default function AdminUsersPage() {
  return (
    <Protected roles={['ADM']}>
      <UsersList />
    </Protected>
  );
}

function UsersList() {
  const [data, setData] = useState<UsersPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<UsersPage>('/api/users', { query: { limit: 50 } })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: unknown) => { if (!cancelled) setError(explainError(e).hint); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="callout callout--danger"><span>{error}</span></div>;
  if (!data) return <div className="muted">Загрузка…</div>;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Пользователи</h1>
        <span className="mono muted">всего: <span className="tnum">{data.total}</span></span>
      </header>

      <div className="card card--bleed">
        <table className="table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роли</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td>{u.lastName} {u.firstName}</td>
                <td className="muted">{u.email}</td>
                <td>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-1)' }}>
                    {u.roles.map((r) => (
                      <span key={r} className="badge">{ROLE_LABELS[r]}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
