'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { homePathForRoles } from '@/lib/types';
import { ApiError } from '@/lib/api';

/**
 * /login — парадный вход АИС.
 * Построен на дизайн-системе /src/styles/design-system:
 *   .card / .field / .input / .btn.btn--primary / .badge
 */
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
      if (err instanceof ApiError && err.status === 429) {
        setError('Слишком много попыток. Попробуйте через минуту.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Неверный email или пароль.');
      } else {
        setError('Не удалось войти. Проверьте подключение.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen paper-grain" style={{ background: 'var(--ais-ink)', color: 'var(--ais-bone)' }}>
      <div className="mx-auto grid min-h-screen max-w-[1280px] grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        {/* ───── LEFT — identity ───── */}
        <section className="flex flex-col justify-between p-8 lg:p-14">
          <header className="row">
            <span className="badge">вход в систему</span>
            <span className="grow" style={{ height: 1, background: 'var(--ais-line)' }} />
          </header>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}
            className="max-w-[560px]"
          >
            <div className="row" style={{ gap: 'var(--s-3)' }}>
              <span
                aria-hidden
                className="sidebar__brand"
                style={{ padding: 0 }}
              >
                <span className="mark">А</span>
              </span>
            </div>

            <h1 className="display" style={{ marginTop: 'var(--s-5)', fontSize: 'clamp(44px, 5.6vw, 68px)' }}>
              АИС Студенты
            </h1>

            <div className="row" style={{ marginTop: 'var(--s-5)' }}>
              <span style={{ height: 1, width: 53, background: 'rgba(143,179,136,0.6)' }} />
              <span className="badge" style={{ textTransform: 'uppercase' }}>
                кабинет сотрудника и обучающегося
              </span>
            </div>

            <p
              style={{
                marginTop: 'var(--s-7)',
                maxWidth: '46ch',
                color: 'var(--ais-bone-2)',
                fontSize: 'var(--fs-15)',
              }}
            >
              Внутренняя информационная система учебного заведения.
              Доступ выдаётся администратором.
            </p>
          </motion.div>

          <footer />

        </section>

        {/* ───── RIGHT — action ───── */}
        <section className="flex items-center justify-center p-8 lg:p-14">
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1], delay: 0.08 }}
            onSubmit={onSubmit}
            className="card card--raised"
            style={{ width: '100%', maxWidth: 400 }}
          >
            <header className="card__head">
              <div>
                <h2 className="card__title" style={{ fontSize: 'var(--fs-22)' }}>Войти</h2>
                <p className="card__sub">используйте корпоративный e-mail</p>
              </div>
            </header>

            <div className="col" style={{ gap: 'var(--s-4)' }}>
              <label className="field">
                <span className="field__label">e-mail <span className="req">*</span></span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@tti.ru"
                />
              </label>

              <label className="field">
                <span className="field__label">пароль <span className="req">*</span></span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="callout callout--danger"
                style={{ marginTop: 'var(--s-4)' }}
                role="alert"
              >
                <span className="icon">!</span>
                <span>{error}</span>
              </motion.div>
            )}

            <div
              className="row"
              style={{
                marginTop: 'var(--s-6)',
                justifyContent: 'space-between',
              }}
            >
              <button type="button" className="btn btn--ghost btn--sm">
                забыли пароль?
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'входим…' : 'Войти →'}
              </button>
            </div>
          </motion.form>
        </section>
      </div>
    </div>
  );
}
