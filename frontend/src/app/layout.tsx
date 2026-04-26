import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider, themeBootstrapScript } from '@/lib/theme-context';
import './globals.css';

/**
 * Шрифты привязаны к дизайн-системе АИС (см. /src/styles/design-system/tokens.css):
 *   — Inter          → --ais-font-sans / --ais-font-display
 *   — JetBrains Mono → --ais-font-mono
 *
 * CSS-переменные --font-sans / --font-mono сохраняются для обратной
 * совместимости со старыми компонентами (ссылаются на те же объявления).
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'АИС · Студенты',
  description: 'Корпоративная платформа для учебных заведений',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
