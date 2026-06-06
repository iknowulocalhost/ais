'use client';

import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/types';
import { MaxIntegrationPanel } from '@/components/max-integration-panel';

export default function MePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 720 }}>
      <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Мой кабинет</h1>
      <dl className="card" style={{ padding: 0 }}>
        <Row label="ФИО" value={`${user.lastName} ${user.firstName}`} />
        <Row label="Email" value={user.email} mono />
        <Row
          label="Роли"
          value={
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-1)' }}>
              {user.roles.map((r) => (
                <span key={r} className="badge">{ROLE_LABELS[r]}</span>
              ))}
            </div>
          }
        />
        <Row label="ID" value={<code className="mono" style={{ fontSize: 'var(--fs-12)' }}>{user.id}</code>} last />
      </dl>

      <MaxIntegrationPanel />
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 'var(--s-4)',
        padding: 'var(--s-4) var(--s-5)',
        borderBottom: last ? 'none' : '1px solid var(--ais-line)',
        fontSize: 'var(--fs-14)',
      }}
    >
      <dt className="mono" style={{ color: 'var(--ais-bone-4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'center' }}>
        {label}
      </dt>
      <dd className={mono ? 'mono' : undefined} style={{ color: 'var(--ais-bone)' }}>
        {value}
      </dd>
    </div>
  );
}
