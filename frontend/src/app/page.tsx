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
    <div className="flex h-screen items-center justify-center text-slate-500">
      Перенаправляем…
    </div>
  );
}
