'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  BookOpen,
  FileText,
  KeyRound,
  Search,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { clsx } from './clsx';
import { Logo } from './logo';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  section: 'main' | 'academic' | 'docs';
}

// Только реальные страницы: /notifications, /absences, /messages не существуют —
// убрал, чтобы у студента не было «битых» ссылок. Журнал и расписание
// доступны студенту — он видит свою группу через `studentExternalId → groupName`.
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Сводка', icon: Home, section: 'main' },

  { href: '/schedule', label: 'Расписание', icon: Calendar, section: 'academic' },
  { href: '/journal', label: 'Электронный журнал', icon: BookOpen, section: 'academic' },

  { href: '/certificates', label: 'Справки', icon: FileText, section: 'docs' },
  { href: '/passes', label: 'Пропуска', icon: KeyRound, section: 'docs' },
];

const SECTION_LABELS: Record<NavItem['section'], string> = {
  main: 'главное',
  academic: 'учебный процесс',
  docs: 'документы',
};

export function StudentSidebar({ mobileOpen = false }: { mobileOpen?: boolean }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('ru');
  const isSearching = q.length > 0;
  const matches = (label: string) => label.toLocaleLowerCase('ru').includes(q);

  const initials = user
    ? `${user.lastName?.[0] ?? ''}${user.firstName?.[0] ?? ''}`.toUpperCase()
    : '';

  // TODO: группа/курс в /api/users/me не приходят — заглушка.
  const group = 'ПМ-221';
  const course = '2 курс';

  const bySection = (['main', 'academic', 'docs'] as const).map((s) => ({
    key: s,
    label: SECTION_LABELS[s],
    items: NAV.filter((i) => i.section === s),
  }));

  return (
    <aside className={clsx('sidebar', mobileOpen && 'is-mobile-open')}>
      <Link href="/dashboard" className="sidebar__brand" aria-label="АИС" style={{ padding: '4px 2px' }}>
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
        {bySection.map((sec) => (
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
                  {n.count !== undefined && <span className="nav__count">{n.count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className="divider" />
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <div className="avatar">{initials || '·'}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 'var(--fs-13)',
                fontWeight: 500,
                color: 'var(--ais-bone)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.lastName} {user?.firstName?.[0]}.
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              {group} · {course}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="btn btn--ghost btn--icon btn--sm"
            aria-label="Выйти из АИС"
            title="Выйти"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}
