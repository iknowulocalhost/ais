'use client';

/**
 * global-error срабатывает, если падает сам RootLayout.
 * Полностью отдельный <html>/<body> — поэтому стили нужно описать inline.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#14151a',
          color: '#e8e6df',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            padding: 24,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22 }}>Критическая ошибка</h1>
          <p style={{ color: 'rgba(232,230,223,0.7)', marginTop: 8 }}>
            Приложение не смогло загрузиться. Обновите страницу; если ошибка повторяется —
            сообщите администратору.
          </p>
          {error?.message && (
            <pre
              style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(0,0,0,0.35)',
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                maxHeight: 160,
                overflow: 'auto',
              }}
            >
              {error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '8px 14px',
                background: '#8fb388',
                color: '#14151a',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Повторить
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
