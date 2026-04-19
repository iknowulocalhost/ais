'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';

interface ProtectedProps {
  roles?: Role[]; // если пусто — просто требуется вход
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
      <div className="flex h-screen items-center justify-center text-slate-500">
        Загрузка…
      </div>
    );
  }
  if (!user) return null;
  if (roles && roles.length > 0 && !hasRole(roles)) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-semibold">Недостаточно прав</h1>
        <p className="mt-2 text-slate-500">
          Требуется одна из ролей: {roles.join(', ')}.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
