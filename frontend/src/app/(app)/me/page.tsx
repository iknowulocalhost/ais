'use client';

import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/types';

export default function MePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Мой кабинет</h1>
      <dl className="mt-6 divide-y divide-slate-200 rounded-lg bg-white ring-1 ring-slate-200">
        <Row label="ФИО" value={`${user.lastName} ${user.firstName}`} />
        <Row label="Email" value={user.email} />
        <Row label="Роли" value={user.roles.map((r) => ROLE_LABELS[r]).join(', ')} />
        <Row label="ID" value={<code className="text-xs">{user.id}</code>} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 px-4 py-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}
