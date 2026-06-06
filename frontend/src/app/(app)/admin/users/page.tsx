'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, KeyRound, Copy, Check, X } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import type { AuthUser, Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

/**
 * Список пользователей АИС для админа: поиск по ФИО/email, фильтр по роли,
 * быстрая кнопка «Сбросить пароль» прямо из таблицы.
 *
 * Сброс пароля делегирован существующему эндпойнту `POST /api/users/:id/reset-password`.
 * Ответ содержит plaintext-пароль, который мы показываем один раз в модалке —
 * админ должен скопировать/распечатать его и передать пользователю.
 */

interface UserListItem extends AuthUser {
  middleName?: string | null;
  netschoolEmployeeId?: number | null;
  studentExternalId?: number | null;
}

interface UsersPage {
  total: number;
  items: UserListItem[];
}

const FILTER_ROLES: Array<{ value: Role | ''; label: string }> = [
  { value: '', label: 'Все роли' },
  { value: 'SUPERADMIN', label: ROLE_LABELS.SUPERADMIN },
  { value: 'ADM', label: ROLE_LABELS.ADM },
  { value: 'ADMINISTRATION', label: ROLE_LABELS.ADMINISTRATION },
  { value: 'COM', label: ROLE_LABELS.COM },
  { value: 'TEA', label: ROLE_LABELS.TEA },
  { value: 'STU', label: ROLE_LABELS.STU },
];

export default function AdminUsersPage() {
  return (
    <Protected roles={['ADM', 'SUPERADMIN']}>
      <UsersList />
    </Protected>
  );
}

function UsersList() {
  const [data, setData] = useState<UsersPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [busy, setBusy] = useState(false);

  // Модалка одноразового показа выданного пароля.
  const [issued, setIssued] = useState<{
    userId: string;
    email: string;
    password: string;
    fullName: string;
  } | null>(null);
  // Какой строке мы прямо сейчас сбрасываем пароль (disable кнопки).
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await apiFetch<UsersPage>('/api/users', {
        query: {
          limit: 100,
          search: search || undefined,
          role: roleFilter || undefined,
        },
      });
      setData(d);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }, [search, roleFilter]);

  useEffect(() => { void load(); }, [load]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  async function resetPassword(u: UserListItem) {
    const fullName = `${u.lastName} ${u.firstName}${u.middleName ? ` ${u.middleName}` : ''}`;
    if (!window.confirm(
      `Сбросить пароль пользователю «${fullName}»? ` +
      `Старый пароль перестанет работать сразу, новый появится в этом окне и больше не сохранится.`,
    )) return;
    setResettingId(u.id);
    try {
      const r = await apiFetch<{ password: string; email: string }>(
        `/api/users/${u.id}/reset-password`,
        { method: 'POST' },
      );
      setIssued({ userId: u.id, email: r.email, password: r.password, fullName });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setResettingId(null);
    }
  }

  async function copyPassword() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  const activeFilters = useMemo(
    () => Boolean(search) || Boolean(roleFilter),
    [search, roleFilter],
  );

  if (error) return <div className="callout callout--danger"><span>{error}</span></div>;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-28)', margin: 0 }}>Пользователи</h1>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          {data && <span className="mono muted">всего: <span className="tnum">{data.total}</span></span>}
          <Link href="/admin/users/new" className="btn btn--primary btn--sm">
            <Plus size={14} strokeWidth={2} /> Создать
          </Link>
        </div>
      </header>

      {/* ── Фильтры ── */}
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={applySearch} className="row" style={{ gap: 'var(--s-2)' }}>
          <div className="input-group" style={{ minWidth: 280 }}>
            <Search size={14} className="icon" />
            <input
              className="input"
              placeholder="ФИО или email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--ghost btn--sm">Найти</button>
        </form>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Роль</span>
          <select
            className="input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            style={{ minWidth: 180 }}
          >
            {FILTER_ROLES.map((r) => (
              <option key={r.value || 'all'} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        {activeFilters && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => { setSearchInput(''); setSearch(''); setRoleFilter(''); }}
            style={{ alignSelf: 'flex-end' }}
          >
            <X size={12} strokeWidth={1.75} /> Сбросить фильтры
          </button>
        )}
      </div>

      {/* ── Таблица ── */}
      {!data && busy ? (
        <div className="muted">Загрузка…</div>
      ) : data && data.items.length === 0 ? (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
          <Search size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>
            {activeFilters ? 'Ничего не найдено по выбранным фильтрам.' : 'Пользователей пока нет.'}
          </span>
        </div>
      ) : data ? (
        <div className="card card--bleed">
          <table className="table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Email</th>
                <th>Роли</th>
                <th>Сетевой ПОО</th>
                <th>Студент</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="link">
                      {u.lastName} {u.firstName}{u.middleName ? ` ${u.middleName}` : ''}
                    </Link>
                  </td>
                  <td className="muted" style={{ fontSize: 'var(--fs-13)' }}>{u.email}</td>
                  <td>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-1)' }}>
                      {u.roles.map((r) => (
                        <span key={r} className="badge" style={{ fontSize: 11 }}>{ROLE_LABELS[r]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
                    {u.netschoolEmployeeId ? `#${u.netschoolEmployeeId}` : '—'}
                  </td>
                  <td className="mono muted" style={{ fontSize: 'var(--fs-13)' }}>
                    {u.studentExternalId ? `#${u.studentExternalId}` : '—'}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                      <Link href={`/admin/users/${u.id}`} className="btn btn--ghost btn--sm">
                        Открыть
                      </Link>
                      <button
                        type="button"
                        onClick={() => void resetPassword(u)}
                        disabled={resettingId === u.id}
                        className="btn btn--ghost btn--sm"
                        title="Сбросить пароль и показать новый один раз"
                      >
                        <KeyRound size={12} strokeWidth={1.75} />
                        {resettingId === u.id ? 'Сбрасываем…' : 'Сбросить пароль'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ── Модалка с выданным паролем ── */}
      {issued && (
        <div
          onClick={() => setIssued(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card col"
            style={{ maxWidth: 520, width: '100%', padding: 'var(--s-5)', gap: 'var(--s-3)' }}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Пароль сброшен</h2>
              <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => setIssued(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)' }}>
              Новый пароль для <b>{issued.fullName}</b>. Скопируйте сейчас — после закрытия окна
              мы его не покажем повторно, восстановить нельзя.
            </p>
            <div className="card" style={{ padding: 'var(--s-4)', background: 'var(--ais-paper-2)' }}>
              <div className="col" style={{ gap: 'var(--s-2)' }}>
                <div className="col" style={{ gap: 2 }}>
                  <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Логин</span>
                  <span className="mono" style={{ fontSize: 'var(--fs-14)' }}>{issued.email}</span>
                </div>
                <div className="col" style={{ gap: 2 }}>
                  <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Пароль</span>
                  <span className="mono" style={{ fontSize: 'var(--fs-18)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {issued.password}
                  </span>
                </div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setIssued(null)}>Закрыть</button>
              <button type="button" className="btn btn--primary" onClick={copyPassword}>
                {copied ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
                {copied ? 'Скопировано' : 'Скопировать пароль'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
