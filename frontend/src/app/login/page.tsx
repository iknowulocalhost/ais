'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { homePathForRoles } from '@/lib/types';
import { ApiError } from '@/lib/api';
import { Logo } from '@/components/logo';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(homePathForRoles(user.roles));
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      router.replace(homePathForRoles(u.roles));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Неверный email или пароль.');
      } else {
        setError('Ошибка входа. Проверьте подключение.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-split">
      {/* Левая панель: Брендинг и Hero */}
      <aside className="auth__brand">
        <header>
          {/* Большой логотип вместо надписи */}
          <Logo height={144} live={false} ariaLabel="АИС" />
        </header>

        <div className="hero">
          <h1 className="hero__title">
            Вход в систему
          </h1>
          <p className="hero__lede">
            Расписание, оценки, ведомости и курсы — в одной среде.
            Единая информационная система учебного заведения.
          </p>
        </div>

        <footer className="meta">
          <div className="col" style={{ gap: '12px' }}>
            <span className="mono" style={{ fontSize: '13px', color: 'var(--ais-bone-3)', letterSpacing: '0.05em' }}>
              2026 ЧТОТиБ | Центр Информационных Технологий
            </span>
          </div>
        </footer>
      </aside>

      {/* Правая панель: Форма входа */}
      <section className="auth__form">
        {/* Декоративные скобки на фоне */}
        <svg className="auth__brackets-bg" viewBox="0 0 600 780" preserveAspectRatio="xMidYMid slice" fill="currentColor">
          <rect x="40" y="120" width="12" height="540" /><rect x="40" y="120" width="80" height="12" /><rect x="40" y="648" width="80" height="12" />
          <rect x="548" y="120" width="12" height="540" /><rect x="480" y="120" width="80" height="12" /><rect x="480" y="648" width="80" height="12" />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-form-box"
        >
          <header className="form__head">
            <span className="mono muted" style={{ fontSize: '12px', letterSpacing: '0.1em' }}>АВТОРИЗАЦИЯ</span>
            <h2 className="form__title-large">Личный кабинет</h2>
          </header>

          <form onSubmit={onSubmit} className="col" style={{ gap: '24px' }}>
            <div className="field">
              <span className="field__label mono" style={{ fontSize: '11px' }}>ЛОГИН</span>
              <input
                className="input"
                style={{ height: '56px', fontSize: '16px' }}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@tti.ru"
              />
            </div>

            <div className="field">
              <span className="field__label mono" style={{ fontSize: '11px' }}>ПАРОЛЬ</span>
              <input
                className="input"
                style={{ height: '56px', fontSize: '16px' }}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="callout callout--danger" style={{ padding: '16px' }}>
                <span className="icon">!</span>
                <span style={{ fontSize: '14px' }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting}
              style={{ height: '64px', justifyContent: 'center', fontSize: '18px', fontWeight: 700 }}
            >
              {submitting ? 'ВХОДИМ...' : 'ВОЙТИ В СИСТЕМУ →'}
            </button>
          </form>
        </motion.div>
      </section>
    </main>
  );
}