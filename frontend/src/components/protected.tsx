'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';

interface ProtectedProps {
  roles?: Role[];
  children: React.ReactNode;
}

/**
 * Клиентский охранник. Серверный middleware не имеет доступа к localStorage,
 * поэтому проверяем на клиенте. 3 состояния: loading → spinner, нет user → redirect /login,
 * нет роли → сообщение «Нет доступа» (без редиректа, чтобы не крутить цикл).
 */
export function Protected({ roles, children }: ProtectedProps) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="mono muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          загрузка…
        </span>
      </div>
    );
  }
  if (!user) return null;
  if (roles && roles.length > 0 && !hasRole(roles)) {
    return (
      <div className="col" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--s-7)', gap: 'var(--s-3)', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-24)' }}>Недостаточно прав</h1>
        <p className="muted" style={{ fontSize: 'var(--fs-14)' }}>
          Требуется одна из ролей: <span className="mono">{roles.join(', ')}</span>.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
