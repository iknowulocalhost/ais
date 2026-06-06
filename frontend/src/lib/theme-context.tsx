'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'ais-theme';

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark';
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Inline-скрипт темы до гидрации (anti-flash). */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`;
