'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  UserCircle,
  UserPlus,
  ScrollText,
  FileText,
  KeyRound,
  MessagesSquare,
  BookOpen,
  CalendarDays,
  ShieldAlert,
  UsersRound,
  Search,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { clsx } from './clsx';
import { JobsIndicator } from './background-jobs';
import { ThemeToggle } from './theme-toggle';
import { Logo } from './logo';
import { StudentSidebar } from './student-sidebar';
import { isStudentOnly } from '@/lib/role-helpers';

type Section = 'admin' | 'academic' | 'teachers' | 'student';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: Section;
}

const ADMIN_ROLES: Role[] = ['SUPERADMIN', 'ADM', 'ADMINISTRATION'];

const NAV: NavItem[] = [
  { href: '/admin/users', label: 'Пользователи', icon: Users, roles: ADMIN_ROLES, section: 'admin' },
  { href: '/admin/comment-options', label: 'Шаблоны комментариев', icon: MessagesSquare, roles: ADMIN_ROLES, section: 'admin' },
  { href: '/audit', label: 'Аудит', icon: ShieldAlert, roles: ['SUPERADMIN'], section: 'admin' },

  { href: '/admissions', label: 'Абитуриент', icon: UserPlus, roles: ['SUPERADMIN', 'COM'], section: 'academic' },
  { href: '/dossier', label: 'Студенты', icon: GraduationCap, roles: [...ADMIN_ROLES, 'COM'], section: 'academic' },
  { href: '/certificates', label: 'Справки', icon: FileText, roles: [...ADMIN_ROLES, 'COM', 'STU'], section: 'academic' },
  { href: '/passes', label: 'Пропуска', icon: KeyRound, roles: [...ADMIN_ROLES, 'COM', 'STU'], section: 'academic' },
  { href: '/orders', label: 'Приказы', icon: ScrollText, roles: [...ADMIN_ROLES, 'COM'], section: 'academic' },

  { href: '/my-group', label: 'Моя группа', icon: UsersRound, roles: [...ADMIN_ROLES, 'TEA'], section: 'teachers' },
  { href: '/journal', label: 'Журнал', icon: BookOpen, roles: [...ADMIN_ROLES, 'COM', 'TEA'], section: 'teachers' },
  { href: '/schedule', label: 'Расписание', icon: CalendarDays, roles: [...ADMIN_ROLES, 'COM', 'TEA'], section: 'teachers' },
  { href: '/reports', label: 'Ведомости и отчёты', icon: BarChart3, roles: [...ADMIN_ROLES, 'COM', 'TEA'], section: 'teachers' },

  { href: '/dashboard', label: 'Сводка', icon: Home, roles: [...ADMIN_ROLES, 'COM', 'TEA', 'STU'], section: 'student' },
  { href: '/me', label: 'Мой профиль', icon: UserCircle, roles: [...ADMIN_ROLES, 'COM', 'TEA', 'STU'], section: 'student' },
];

const SECTION_LABELS: Record<Section, string> = {
  admin: 'администрация',
  academic: 'учебная часть',
  teachers: 'преподаватели',
  student: 'кабинет',
};

const SECTION_ORDER: Section[] = ['admin', 'academic', 'teachers', 'student'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();
  if (isStudentOnly(user)) {
    return <StudentShell>{children}</StudentShell>;
  }
  const items = NAV.filter((n) => hasRole(n.roles));

  const initials = user ? `${user.lastName?.[0] ?? ''}${user.firstName?.[0] ?? ''}`.toUpperCase() : '';

  const bySection = SECTION_ORDER.map((s) => ({
    key: s,
    label: SECTION_LABELS[s],
    items: items.filter((i) => i.section === s),
  }));

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('ru');
  const isSearching = q.length > 0;
  const matches = (label: string) => label.toLocaleLowerCase('ru').includes(q);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  return (
    <div className={clsx('app-shell', menuOpen && 'is-mobile-open')} style={{ display: 'flex', minHeight: '100vh', background: 'var(--ais-ink)', color: 'var(--ais-bone)' }}>
      <aside className={clsx('sidebar', menuOpen && 'is-mobile-open')}>
        <Link href="/" className="sidebar__brand" aria-label="АИС" style={{ padding: '4px 2px' }}>
          <Logo height={52} />
        </Link>

        <div className="input-group">
          <Search size={14} className="icon" />
          <input
            className="input"
            placeholder="Поиск"
            aria-label="Поиск"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: '8px 12px 8px 0', fontSize: 'var(--fs-13)' }}
          />
        </div>

        <nav className="nav" aria-label="Основная навигация">
          {bySection.map((sec) =>
            sec.items.length === 0 ? null : (
              <div key={sec.key}>
                <div className="nav__section">{sec.label}</div>
                {sec.items.map((n) => {
                  const active = pathname === n.href || pathname?.startsWith(n.href + '/');
                  const match = isSearching && matches(n.label);
                  const dimmed = isSearching && !match;
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      tabIndex={dimmed ? -1 : undefined}
                      aria-disabled={dimmed || undefined}
                      className={clsx(
                        'nav__item',
                        !isSearching && active && 'is-active',
                        match && 'is-match',
                        dimmed && 'is-dimmed',
                      )}
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
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

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

function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  return (
    <div
      className={clsx('app-shell', menuOpen && 'is-mobile-open')}
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--ais-ink)', color: 'var(--ais-bone)' }}
    >
      <StudentSidebar mobileOpen={menuOpen} />
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
            position: 'sticky', top: 0, zIndex: 20, height: 56,
            display: 'flex', alignItems: 'center', gap: 'var(--s-3)',
            background: 'var(--ais-veil)', borderBottom: '1px solid var(--ais-line)',
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
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
