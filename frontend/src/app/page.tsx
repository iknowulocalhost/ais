'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { homePathForRoles } from '@/lib/types';

/** Корневая страница: редиректит авторизованных в ролевой home, гостей — в /login. */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? homePathForRoles(user.roles) : '/login');
  }, [loading, user, router]);

  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: 'var(--ais-ink)', color: 'var(--ais-bone-3)' }}
    >
      <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        перенаправляем…
      </span>
    </div>
  );
}
