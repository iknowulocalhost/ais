'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

/** «Уведомления в МАХ»: status + connect (deep-link) + disconnect. */
export function MaxIntegrationPanel() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingLink | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ linked: boolean }>('/api/integrations/max/status');
      setLinked(res.linked);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка загрузки статуса');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onConnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{
        token: string;
        deepLink: string | null;
        expiresAt: string;
      }>('/api/integrations/max/link-token', { method: 'POST' });
      setPending({ token: res.token, deepLink: res.deepLink, expiresAt: res.expiresAt });
      if (res.deepLink) {
        // Новая вкладка → мобильный MAX перехватит и откроет приложение.
        window.open(res.deepLink, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать ссылку');
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (!confirm('Отключить уведомления в МАХ? Аккаунт можно подключить заново в любой момент.')) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/integrations/max/link', { method: 'DELETE' });
      setLinked(false);
      setPending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отключить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ padding: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--s-3)' }}>
        <h2 style={{ fontSize: 'var(--fs-18)', margin: 0 }}>Уведомления в МАХ</h2>
        {linked === true && (
          <span className="badge" style={{ background: 'var(--ais-ok)', color: '#fff' }}>Подключено</span>
        )}
        {linked === false && (
          <span className="badge muted">Не подключено</span>
        )}
      </header>

      <p style={{ color: 'var(--ais-bone-4)', fontSize: 'var(--fs-13)', marginBottom: 'var(--s-4)' }}>
        АИС будет присылать в мессенджер МАХ важные уведомления: статус заявок,
        напоминания о долгах и аттестации, изменения в группе. Email сейчас не
        используется — отказ от привязки означает отсутствие уведомлений.
      </p>

      {error && (
        <div className="callout callout--danger" style={{ marginBottom: 'var(--s-3)', padding: 'var(--s-3)' }}>
          {error}
        </div>
      )}

      {pending && (
        <div
          className="callout"
          style={{
            display: 'block',
            marginBottom: 'var(--s-3)',
            padding: 'var(--s-4)',
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Откройте бота в МАХ.</strong>{' '}
            {pending.deepLink ? (
              <>
                Если новая вкладка не открылась — нажмите{' '}
                <a href={pending.deepLink} target="_blank" rel="noopener noreferrer">эту ссылку</a>.
              </>
            ) : (
              <>
                Найдите бота вручную и пришлите ему сообщение:{' '}
                <code className="mono">/start link_{pending.token}</code>.
              </>
            )}
          </p>
          <p className="muted" style={{ margin: 'var(--s-2) 0 0', fontSize: 'var(--fs-12)' }}>
            Ссылка действует 10 минут. После подтверждения в МАХ — обновите страницу.
          </p>
          <div style={{ marginTop: 'var(--s-3)' }}>
            <button type="button" className="btn btn--ghost" onClick={refresh} disabled={busy}>
              Проверить статус
            </button>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 'var(--s-2)' }}>
        {linked ? (
          <button type="button" className="btn btn--danger-ghost" onClick={onDisconnect} disabled={busy}>
            Отключить МАХ
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onConnect} disabled={busy}>
            {busy ? 'Создаём ссылку…' : 'Подключить МАХ'}
          </button>
        )}
      </div>
    </section>
  );
}

interface PendingLink {
  token: string;
  deepLink: string | null;
  expiresAt: string;
}
