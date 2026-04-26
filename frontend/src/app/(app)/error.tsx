'use client';

/**
 * Error boundary для защищённой зоны (group (app)).
 * Показывается внутри AppShell, поэтому сохраняется шапка/навигация.
 */

import { useEffect } from 'react';
import { explainError } from '@/lib/errors';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[AppError]', error);
    }
  }, [error]);

  const { title, hint, detail } = explainError(error);

  return (
    <div className="col" style={{ gap: 'var(--s-5)', padding: 'var(--s-6) 0' }}>
      <div className="callout callout--danger" role="alert">
        <span className="icon">!</span>
        <div className="col" style={{ gap: 'var(--s-1)' }}>
          <strong style={{ fontSize: 'var(--fs-15)' }}>{title}</strong>
          <span style={{ color: 'var(--ais-bone-2)', fontSize: 'var(--fs-13)' }}>{hint}</span>
        </div>
      </div>

      {detail && (
        <pre
          className="mono"
          style={{
            margin: 0,
            padding: 'var(--s-3)',
            background: 'var(--ais-paper-2, rgba(255,255,255,0.04))',
            border: '1px solid var(--ais-line)',
            borderRadius: 'var(--r-6, 6px)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: 'var(--ais-bone-3)',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {detail}
        </pre>
      )}

      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => reset()}>
          Повторить
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => window.history.back()}
        >
          назад
        </button>
      </div>
    </div>
  );
}
