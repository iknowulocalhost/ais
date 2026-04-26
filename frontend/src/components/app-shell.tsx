'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { clsx } from './clsx';
import { JobsIndicator } from './background-jobs';

/**
 * AppShell — sidebar-layout из дизайн-системы АИС
 * (см. /src/styles/design-system/components.css, блок NAV / SIDEBAR).
 *
 * Левая колонка — .sidebar с .nav-списком, разбитым на секции.
 * Шапка справа — имя пользователя, индикатор фоновых задач, выход.
 */

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  section: 'main' | 'academic' | 'finance' | 'me';
}

const ALL_ROLES: Role[] = ['SUPERADMIN','ADM','ACC','COM','INF','TEA','ANA','PHO','STU'];

const NAV: NavItem[] = [
  { href: '/dashboard',    label: 'Сводка',        roles: ALL_ROLES,                                 section: 'main' },
  { href: '/admin/users',  label: 'Пользователи',  roles: ['ADM'],                                    section: 'main' },
  { href: '/applications', label: 'Заявки',        roles: ['ADM', 'COM'],                             section: 'main' },

  { href: '/students',     label: 'Студенты',      roles: ['ADM', 'TEA', 'COM', 'ANA'],               section: 'academic' },
  { href: '/curriculum',   label: 'Учебные планы', roles: ['ADM', 'TEA', 'ANA'],                      section: 'academic' },
  { href: '/grades',       label: 'Ведомости',     roles: ['ADM', 'TEA', 'ANA'],                      section: 'academic' },

  { href: '/payments',     label: 'Платежи',       roles: ['ADM', 'ACC', 'ANA'],                      section: 'finance' },
  { href: '/reports',      label: 'Отчёты',        roles: ['ADM', 'ANA'],                             section: 'finance' },

  { href: '/me',           label: 'Мой кабинет',   roles: ['STU', 'TEA', 'ACC', 'COM', 'ADM', 'ANA', 'INF', 'PHO'], section: 'me' },
];

const SECTION_LABELS: Record<NavItem['section'], string> = {
  main:     'основное',
  academic: 'учебная часть',
  finance:  'финансы и отчёты',
  me:       'личное',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const items = NAV.filter((n) => hasRole(n.roles));

  const initials = user ? `${user.lastName?.[0] ?? ''}${user.firstName?.[0] ?? ''}`.toUpperCase() : '';

  const bySection = (['main', 'academic', 'finance', 'me'] as const).map((s) => ({
    key: s,
    label: SECTION_LABELS[s],
    items: items.filter((i) => i.section === s),
  }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ais-ink)', color: 'var(--ais-bone)' }}>
      <aside className="sidebar">
        <Link href="/" className="sidebar__brand">
          <span className="mark">А</span>
          <span className="name">
            АИС <span className="dim">Студенты</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Основная навигация">
          {bySection.map((sec) =>
            sec.items.length === 0 ? null : (
              <div key={sec.key}>
                <div className="nav__section">{sec.label}</div>
                {sec.items.map((n) => {
                  const active = pathname === n.href || pathname?.startsWith(n.href + '/');
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={clsx('nav__item', active && 'is-active')}
                    >
                      <span>{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            ),
          )}
        </nav>

        <div className="sidebar__foot">
          <div className="divider" />
          <div className="row" style={{ gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
            <div className="avatar">{initials || '·'}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 'var(--fs-13)', fontWeight: 500, color: 'var(--ais-bone)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.lastName} {user?.firstName}
              </div>
              <div className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
              </div>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--s-3)' }}
          >
            Выйти
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            height: 56,
            padding: '0 var(--s-7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--s-3)',
            background: 'rgba(14,14,12,0.82)',
            borderBottom: '1px solid var(--ais-line)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <JobsIndicator />
        </header>

        <main style={{ padding: 'var(--s-7) var(--s-8)', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
