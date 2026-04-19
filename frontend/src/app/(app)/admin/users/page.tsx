'use client';

import { useEffect, useState } from 'react';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
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
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="text-slate-500">Загрузка…</div>;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Пользователи</h1>
        <span className="text-sm text-slate-500">всего: {data.total}</span>
      </div>
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">ФИО</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Роли</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{u.lastName} {u.firstName}</td>
                <td className="px-4 py-2 text-slate-700">{u.email}</td>
                <td className="px-4 py-2 text-slate-700">
                  {u.roles.map((r) => ROLE_LABELS[r]).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
