'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import type { AuthUser } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

interface UserListItem extends AuthUser {
  netschoolEmployeeId?: number | null;
}

interface UsersPage {
  total: number;
  items: UserListItem[];
}

export default function AdminUsersPage() {
  return (
    <Protected roles={['ADM', 'SUPERADMIN']}>
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
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Пользователи</h1>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <span className="mono muted">всего: <span className="tnum">{data.total}</span></span>
          <Link href="/admin/users/new" className="btn btn--primary btn--sm">
            <Plus size={14} strokeWidth={2} /> Создать
          </Link>
        </div>
      </header>

      <div className="card card--bleed">
        <table className="table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Роли</th>
              <th>Сетевой ПОО</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="link">
                    {u.lastName} {u.firstName}
                  </Link>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-1)' }}>
                    {u.roles.map((r) => (
                      <span key={r} className="badge">{ROLE_LABELS[r]}</span>
                    ))}
                  </div>
                </td>
                <td className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
                  {u.netschoolEmployeeId ? `#${u.netschoolEmployeeId}` : '—'}
                </td>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="btn btn--ghost btn--sm">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
