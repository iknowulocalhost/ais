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
        setError('Неверный логин или пароль.');
      } else {
        setError('Ошибка входа. Проверьте подключение к сети.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-split">
      <aside className="auth__brand">
        <header>
          <Logo height={244} live={false} ariaLabel="АИС" />
        </header>

        <div className="hero">
          <h1 className="hero__title">
            Вход в систему
          </h1>
          <p className="hero__lede">
            АИС:Студенты — это информационная среда, созданная для обеспечения студентов и преподавателей удобным доступом к актуальному расписанию, учебным материалам и академической информации в рамках образовательного процесса колледжа.
          </p>
        </div>

        <footer className="meta">
          <div className="col">
            <span className="mono muted" style={{ fontSize: '13px', letterSpacing: '0.05em' }}>
              2026 ЧТОТиБ | Центр Информационных Технологий
            </span>
          </div>
        </footer>
      </aside>

      <section className="auth__form">
        <svg className="auth__brackets-bg" viewBox="0 0 600 780" preserveAspectRatio="xMidYMid slice" fill="currentColor">
          <rect x="40" y="120" width="12" height="540" /><rect x="40" y="120" width="80" height="12" /><rect x="40" y="648" width="80" height="12" />
          <rect x="548" y="120" width="12" height="540" /><rect x="480" y="120" width="80" height="12" /><rect x="480" y="648" width="80" height="12" />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-form-box"
        >
          {/* Центрируемая в адаптиве шапка */}
          <header className="auth-form__head">
            <span className="mono muted" style={{ fontSize: '12px', letterSpacing: '0.1em' }}>АВТОРИЗАЦИЯ</span>
            <h2 className="form__title-large">Личный кабинет</h2>
          </header>

          <form onSubmit={onSubmit} className="col" style={{ gap: '24px' }}>
            <div className="field">
              <span className="field__label mono" style={{ fontSize: '11px' }}>ЛОГИН</span>
              <input
                className="input"
                style={{ height: '56px', fontSize: '16px' }}
                type="text"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="доменный логин или email"
              />
            </div>

            <div className="field">
              <span className="field__label mono" style={{ fontSize: '11px' }}>ПАРОЛЬ</span>
              <input
                className="input auth-form__input"
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

          <footer>
            <p className="muted" style={{ fontSize: '13px', lineHeight: '1.6', textAlign: 'center', maxWidth: '42ch', margin: 'var(--s-4) auto 0' }}>
              Если вы забыли пароль или ещё не получили аккаунт, обратитесь к куратору вашей учебной группы.
            </p>
          </footer>
        </motion.div>
      </section>
    </main>
  );
}