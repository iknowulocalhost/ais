'use client';

/**
 * Корневой error boundary (App Router). Ловит любую необработанную
 * ошибку рендеринга / загрузки данных и показывает человекочитаемое
 * сообщение на русском вместо красного оверлея Next.js.
 */

import { useEffect } from 'react';
import { explainError } from '@/lib/errors';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[RootError]', error);
    }
  }, [error]);

  const { title, hint, detail } = explainError(error);

  return (
    <div
      className="min-h-screen paper-grain"
      style={{
        background: 'var(--ais-ink)',
        color: 'var(--ais-bone)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--s-6)',
      }}
    >
      <div className="card card--raised" style={{ maxWidth: 520, width: '100%' }}>
        <header className="card__head">
          <div>
            <h1 className="card__title" style={{ fontSize: 'var(--fs-22)' }}>{title}</h1>
            <p className="card__sub">{hint}</p>
          </div>
          <span className="badge badge--bad">ошибка</span>
        </header>

        {detail && (
          <pre
            className="mono"
            style={{
              marginTop: 'var(--s-4)',
              padding: 'var(--s-3)',
              background: 'var(--ais-paper-2, rgba(255,255,255,0.04))',
              border: '1px solid var(--ais-line)',
              borderRadius: 'var(--r-6, 6px)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              color: 'var(--ais-bone-2)',
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {detail}
          </pre>
        )}

        <div className="row" style={{ gap: 'var(--s-2)', marginTop: 'var(--s-5)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.location.assign('/')}>
            на главную
          </button>
          <button type="button" className="btn btn--primary" onClick={() => reset()}>
            Повторить
          </button>
        </div>
      </div>
    </div>
  );
}
