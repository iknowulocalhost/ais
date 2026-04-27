'use client';

import { UsersRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function MyGroupPage() {
  const { hasRole } = useAuth();

  if (!hasRole(['SUPERADMIN', 'ADM', 'TEA'])) {
    return (
      <div className="col" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--s-7)', gap: 'var(--s-3)', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-22)' }}>Недостаточно прав</h1>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 1040 }}>
      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          преподаватели
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
          Группа
        </h1>
      </header>

      <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
        <UsersRound size={36} strokeWidth={1.5} />
        <span style={{ fontSize: 'var(--fs-14)' }}>Раздел в разработке</span>
      </div>
    </div>
  );
}
