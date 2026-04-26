import Link from 'next/link';

export default function NotFound() {
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
      <div className="card card--raised" style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'clamp(48px, 8vw, 88px)', margin: 0 }}>404</h1>
        <p className="card__sub" style={{ marginTop: 'var(--s-3)' }}>
          Такой страницы нет. Возможно, ссылка устарела или раздел был перемещён.
        </p>
        <div className="row" style={{ gap: 'var(--s-2)', marginTop: 'var(--s-5)', justifyContent: 'center' }}>
          <Link href="/" className="btn btn--primary">
            на главную
          </Link>
        </div>
      </div>
    </div>
  );
}
