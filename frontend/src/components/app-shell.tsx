'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS, type Role } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: '/admin/users',  label: 'Пользователи', roles: ['ADM'] },
  { href: '/applications', label: 'Заявки',       roles: ['ADM', 'COM'] },
  { href: '/students',     label: 'Студенты',     roles: ['ADM', 'TEA', 'COM', 'ANA'] },
  { href: '/curriculum',   label: 'Учебные планы',roles: ['ADM', 'TEA', 'ANA'] },
  { href: '/grades',       label: 'Ведомости',    roles: ['ADM', 'TEA', 'ANA'] },
  { href: '/payments',     label: 'Платежи',      roles: ['ADM', 'ACC', 'ANA'] },
  { href: '/reports',      label: 'Отчёты',       roles: ['ADM', 'ANA'] },
  { href: '/me',           label: 'Мой кабинет',  roles: ['STU', 'TEA', 'ACC', 'COM', 'ADM', 'ANA', 'INF', 'PHO'] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const items = NAV.filter((n) => hasRole(n.roles));

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold">
              АИС<span className="text-blue-600">:</span>Студенты
            </Link>
            <nav className="flex gap-1">
              {items.map((n) => {
                const active = pathname === n.href || pathname?.startsWith(n.href + '/');
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`relative rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {n.label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-2 -bottom-0.5 h-0.5 bg-blue-600"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium">
                {user?.lastName} {user?.firstName}
              </div>
              <div className="text-xs text-slate-500">
                {user?.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-50"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
