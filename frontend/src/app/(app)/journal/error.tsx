'use client';

import Link from 'next/link';

export default function JournalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="col" style={{ gap: 'var(--s-4)', padding: 'var(--s-5)' }}>
      <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>
        Не удалось показать журнал
      </h2>
      <p className="muted" style={{ fontSize: 'var(--fs-13)' }}>
        {error.message || 'Внутренняя ошибка интерфейса.'}
      </p>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button className="btn btn--primary" onClick={() => reset()}>Перезагрузить</button>
        <Link className="btn btn--ghost" href="/journal">К списку групп</Link>
      </div>
    </div>
  );
}
