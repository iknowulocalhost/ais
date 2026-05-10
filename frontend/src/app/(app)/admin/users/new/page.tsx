'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const ALL_ROLES: Role[] = [
  'SUPERADMIN', 'ADM', 'ADMINISTRATION', 'COM', 'TEA', 'STU',
];

export default function CreateUserPage() {
  return (
    <Protected roles={['ADM', 'SUPERADMIN']}>
      <CreateUserForm />
    </Protected>
  );
}

function CreateUserForm() {
  const router = useRouter();
  const { user: actor } = useAuth();
  const actorIsSuper = !!actor?.roles.includes('SUPERADMIN');

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState<Set<Role>>(new Set(['STU']));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; email: string } | null>(null);

  function toggle(r: Role) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function generatePassword() {
    // 14 знаков: буквы + цифры + минимум один спецсимвол
    const lo = 'abcdefghijklmnopqrstuvwxyz';
    const hi = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const dg = '23456789';
    const sp = '!@#$%&*?';
    const all = lo + hi + dg + sp;
    let out = '';
    out += hi[rand(hi.length)];
    out += lo[rand(lo.length)];
    out += dg[rand(dg.length)];
    out += sp[rand(sp.length)];
    for (let i = 0; i < 10; i++) out += all[rand(all.length)];
    setPassword(shuffle(out));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (picked.size === 0) {
      setError('Выберите хотя бы одну роль');
      return;
    }
    if (password.length < 10) {
      setError('Пароль должен быть не короче 10 символов');
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ id: string; email: string }>('/api/users', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim() || undefined,
          password,
          roles: [...picked],
        },
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : explainError(err).hint);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="col" style={{ gap: 'var(--s-4)', maxWidth: 540 }}>
        <button onClick={() => router.push('/admin/users')} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} strokeWidth={1.75} /> К списку
        </button>
        <div className="card col" style={{ padding: 'var(--s-5)', gap: 'var(--s-3)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>
            Пользователь создан ✓
          </h1>
          <div className="col" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Email</span>
            <span className="mono">{result.email}</span>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Пароль (запомните или передайте сейчас!)</span>
            <span className="mono" style={{ padding: '6px 10px', background: 'var(--ais-paper-2)', borderRadius: 6, wordBreak: 'break-all' }}>
              {password}
            </span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-12)' }}>
            Сохраните пароль сейчас — после ухода со страницы он недоступен.
          </p>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => router.push(`/admin/users/${result.id}`)}>
              Открыть карточку
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => { setResult(null); setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setMiddleName(''); setPicked(new Set(['STU'])); }}>
              Создать ещё
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="col" style={{ gap: 'var(--s-4)', maxWidth: 720 }}>
      <button type="button" onClick={() => router.back()} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> Назад
      </button>

      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          администрация · новый пользователь
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(22px, 2.4vw, 32px)', margin: 0 }}>
          Создание пользователя
        </h1>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Email</span>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@chtotib.ru" />
        </label>

        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <label className="col" style={{ gap: 4, flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Фамилия</span>
            <input className="input" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 4, flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Имя</span>
            <input className="input" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 4, flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Отчество</span>
            <input className="input" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </label>
        </div>

        <div className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Пароль (минимум 10 символов)</span>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <input
              className="input mono"
              type="text"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="введите или нажмите «сгенерировать»"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={generatePassword}>
              <RefreshCw size={14} strokeWidth={1.75} /> Сгенерировать
            </button>
          </div>
        </div>
      </div>

      <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Роли</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--s-2)' }}>
          {ALL_ROLES.map((r) => {
            const checked = picked.has(r);
            const disabled = r === 'SUPERADMIN' && !actorIsSuper;
            return (
              <label
                key={r}
                className="row"
                style={{
                  gap: 'var(--s-2)', alignItems: 'center', padding: '8px 10px',
                  borderRadius: 8, border: '1px solid var(--ais-line)',
                  background: checked ? 'var(--ais-paper-2)' : 'transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(r)}
                />
                <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--fs-13)', fontWeight: 500 }}>{ROLE_LABELS[r]}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>
                    {r}{disabled ? ' · только SUPERADMIN' : ''}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => router.back()}>Отмена</button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          {busy ? 'Создание…' : 'Создать пользователя'}
        </button>
      </div>
    </form>
  );
}

function rand(n: number): number {
  return Math.floor((typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF
    : Math.random()) * n);
}
function shuffle(s: string): string {
  const a = s.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}
