'use client';

import { useTheme } from '@/lib/theme-context';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn--ghost btn--sm"
      aria-label={isLight ? 'Включить тёмную тему' : 'Включить светлую тему'}
      title={isLight ? 'Тёмная тема' : 'Светлая тема'}
    >
      {isLight ? '☾' : '☀'}
    </button>
  );
}
