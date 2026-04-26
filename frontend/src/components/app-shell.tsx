'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Inbox,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  UserCircle,
  UserPlus,
  Search,
  Settings,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { clsx } from './clsx';
import { JobsIndicator } from './background-jobs';
import { ThemeToggle } from './theme-toggle';
import { StudentSidebar } from './student-sidebar';
import { Logo } from './logo';
import { isStudentOnly } from '@/lib/role-helpers';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: 'main' | 'academic' | 'finance' | 'me';
}

const ALL_ROLES: Role[] = ['SUPERADMIN','ADM','ACC','COM','INF','TEA','ANA','PHO','STU'];

const NAV: NavItem[] = [
  { href: '/dashboard',    label: 'Сводка',        icon: Home,            roles: ALL_ROLES,                                 section: 'main' },
  { href: '/admin/users',  label: 'Пользователи',  icon: Users,           roles: ['ADM'],                                    section: 'main' },
  { href: '/applications', label: 'Заявки',        icon: Inbox,           roles: ['ADM', 'COM'],                             section: 'main' },

  { href: '/admissions',   label: 'Абитуриент',    icon: UserPlus,        roles: ['ADM', 'COM'],                             section: 'academic' },
  { href: '/students',     label: 'Студенты',      icon: GraduationCap,   roles: ['ADM', 'TEA', 'COM', 'ANA'],               section: 'academic' },
  { href: '/curriculum',   label: 'Учебные планы', icon: BookOpen,        roles: ['ADM', 'TEA', 'ANA'],                      section: 'academic' },
  { href: '/grades',       label: 'Ведомости',     icon: ClipboardCheck,  roles: ['ADM', 'TEA', 'ANA'],                      section: 'academic' },

  { href: '/reports',      label: 'Отчёты',        icon: BarChart3,       roles: ['ADM', 'ANA'],                             section: 'finance' },

  { href: '/me',           label: 'Мой кабинет',   icon: UserCircle,      roles: ['STU', 'TEA', 'ACC', 'COM', 'ADM', 'ANA', 'INF', 'PHO'], section: 'me' },
];

const SECTION_LABELS: Record<NavItem['section'], string> = {
  main:     'основное',
  academic: 'учебная часть',
  finance:  'отчёты',
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

  const studentMode = isStudentOnly(user);

  const [menuOpen, setMenuOpen] = useState(false);
  // закрывать мобильное меню при навигации
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // блокировать скролл фона, пока открыт оверлей
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  return (
    <div className={clsx('app-shell', menuOpen && 'is-mobile-open')} style={{ display: 'flex', minHeight: '100vh', background: 'var(--ais-ink)', color: 'var(--ais-bone)' }}>
      {studentMode ? <StudentSidebar mobileOpen={menuOpen} /> : (
      <aside className={clsx('sidebar', menuOpen && 'is-mobile-open')}>
        <Link href="/" className="sidebar__brand" aria-label="АИС Студент" style={{ padding: '4px 2px' }}>
          <Logo height={52} style={{ maxWidth: '100%' }} />
        </Link>

        <div className="input-group">
          <Search size={14} className="icon" />
          <input className="input" placeholder="Поиск" aria-label="Поиск" style={{ padding: '8px 12px 8px 0', fontSize: 'var(--fs-13)' }} />
        </div>

        <nav className="nav" aria-label="Основная навигация">
          {bySection.map((sec) =>
            sec.items.length === 0 ? null : (
              <div key={sec.key}>
                <div className="nav__section">{sec.label}</div>
                {sec.items.map((n) => {
                  const active = pathname === n.href || pathname?.startsWith(n.href + '/');
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={clsx('nav__item', active && 'is-active')}
                    >
                      <Icon size={16} className="icon" strokeWidth={1.75} />
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
          <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', marginTop: 'var(--s-3)' }}>
            <div className="avatar">{initials || '·'}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 'var(--fs-13)', fontWeight: 500, color: 'var(--ais-bone)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.lastName} {user?.firstName?.[0]}.
              </div>
              <div className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="btn btn--ghost btn--icon btn--sm"
              aria-label="Выход"
              title="Выход"
            >
              <Settings size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* мобильный фон-оверлей */}
      <button
        type="button"
        className={clsx('sidebar-backdrop', menuOpen && 'is-visible')}
        aria-label="Закрыть меню"
        onClick={() => setMenuOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          className="app-header"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s-3)',
            background: 'var(--ais-veil)',
            borderBottom: '1px solid var(--ais-line)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <button
            type="button"
            className="menu-toggle btn btn--ghost btn--icon btn--sm"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
          </button>
          <div style={{ flex: 1 }} />
          <JobsIndicator />
          <ThemeToggle />
        </header>

        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
