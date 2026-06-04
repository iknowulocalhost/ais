'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface MaxStatus {
  linked: boolean;
  skipCount: number;
  mustLink: boolean;
}

/** Модалка-приглашение привязать MAX. ≥2 пропусков → блокирующий режим. */
export function MaxLinkGate() {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const [status, setStatus] = useState<MaxStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ token: string; deepLink: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedFor = useRef<string | null>(null);

  const suppressed = !user || pathname.startsWith('/login') || pathname.startsWith('/me');

  useEffect(() => {
    if (suppressed) return;
    if (fetchedFor.current === user!.id) return;
    fetchedFor.current = user!.id;
    apiFetch<MaxStatus>('/api/integrations/max/status')
      .then((s) => {
        setStatus(s);
        if (!s.linked) setOpen(true);
      })
      .catch(() => {});
  }, [suppressed, user]);

  const onLater = useCallback(async () => {
    if (!status || status.mustLink) return;
    setBusy(true);
    try {
      const next = await apiFetch<{ skipCount: number }>('/api/integrations/max/skip-prompt', {
        method: 'POST',
      });
      setStatus((s) => (s ? { ...s, skipCount: next.skipCount, mustLink: next.skipCount >= 2 } : s));
      setOpen(false);
    } catch {
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }, [status]);

  const onConnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ token: string; deepLink: string | null }>(
        '/api/integrations/max/link-token',
        { method: 'POST' },
      );
      setPending({ token: r.token, deepLink: r.deepLink });
      if (r.deepLink) window.open(r.deepLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать ссылку');
    } finally {
      setBusy(false);
    }
  }, []);

  const onCheck = useCallback(async () => {
    setBusy(true);
    try {
      const s = await apiFetch<MaxStatus>('/api/integrations/max/status');
      setStatus(s);
      if (s.linked) {
        setOpen(false);
        setPending(null);
      }
    } catch {}
    finally {
      setBusy(false);
    }
  }, []);

  if (suppressed || !open || !status || status.linked) return null;

  const canClose = !status.mustLink;
  const remaining = Math.max(0, 2 - status.skipCount);

  return (
    <div
      onClick={canClose ? onLater : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-4)',
      }}
    >
      <div
        className="card col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%', padding: 'var(--s-6)', gap: 'var(--s-4)' }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--s-3)' }}>
          <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
            <MessageCircle size={22} strokeWidth={1.75} aria-hidden />
            <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>
              Уведомления в МАХ
            </h2>
          </div>
          {canClose && (
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--sm"
              onClick={onLater}
              disabled={busy}
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--ais-bone-2)', fontSize: 'var(--fs-14)' }}>
          АИС шлёт уведомления (статус заявок, долги, аттестация) только в мессенджер МАХ.
          Email не используется — без привязки уведомлений не будет.
        </p>

        {canClose ? (
          <div
            className="callout"
            style={{
              display: 'block',
              padding: 'var(--s-4) var(--s-5)',
              fontSize: 'var(--fs-13)',
              lineHeight: 1.7,
            }}
          >
            Этот запрос можно проигнорировать ещё <strong>{remaining}</strong>{' '}
            {remaining === 1 ? 'раз' : 'раза'}. Дальше вход без привязки станет недоступен.
          </div>
        ) : (
          <div
            className="callout callout--danger"
            style={{
              display: 'block',
              padding: 'var(--s-4) var(--s-5)',
              fontSize: 'var(--fs-13)',
              lineHeight: 1.7,
            }}
          >
            Вы пропустили этот шаг дважды. Дальнейшая работа без привязки невозможна —
            подключите МАХ или выйдите из аккаунта.
          </div>
        )}

        {error && (
          <div
            className="callout callout--danger"
            style={{
              display: 'block',
              padding: 'var(--s-4) var(--s-5)',
              fontSize: 'var(--fs-13)',
              lineHeight: 1.7,
            }}
          >
            {error}
          </div>
        )}

        {pending && (
          <div
            className="callout"
            style={{
              display: 'block',
              padding: 'var(--s-4) var(--s-5)',
              fontSize: 'var(--fs-13)',
              lineHeight: 1.7,
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
                  Найдите бота и отправьте: <code className="mono">/start link_{pending.token}</code>.
                </>
              )}
            </p>
            <p className="muted" style={{ margin: 'var(--s-3) 0 0', fontSize: 'var(--fs-12)', lineHeight: 1.6 }}>
              Ссылка действует 10 минут. После подтверждения нажмите «Проверить статус».
            </p>
          </div>
        )}

        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-2)' }}>
          {!pending ? (
            <button type="button" className="btn btn--primary" onClick={onConnect} disabled={busy}>
              {busy ? 'Создаём ссылку…' : 'Подключить МАХ'}
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={onCheck} disabled={busy}>
              {busy ? 'Проверка…' : 'Проверить статус'}
            </button>
          )}
          {canClose ? (
            <button type="button" className="btn btn--ghost" onClick={onLater} disabled={busy}>
              Позже
            </button>
          ) : (
            <Link
              href="/login"
              className="btn btn--ghost"
              onClick={() => { try { localStorage.clear(); } catch {} }}
              style={{ marginLeft: 'auto' }}
            >
              Выйти
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
