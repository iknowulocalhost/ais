'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, X, Check, RotateCcw } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const ALL_ROLES: Role[] = [
  'SUPERADMIN', 'ADM', 'ADMINISTRATION', 'COM', 'TEA', 'STU',
];

/**
 * Карточка пользователя для админа.
 * Сейчас умеет только привязывать к сотруднику Сетевого ПОО (для TEA-роли).
 * В будущем сюда уедут блок ролей, статус, генерация студ. аккаунтов.
 */

interface UserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  roles: Role[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  netschoolEmployeeId?: number | null;
}

interface PzaEmployee {
  id: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  positionName?: string;
  isFired?: boolean;
}

export default function AdminUserDetailPage() {
  return (
    <Protected roles={['ADM', 'SUPERADMIN']}>
      <UserDetail />
    </Protected>
  );
}

function UserDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params?.id;
  const [user, setUser] = useState<UserView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoadingUser(true);
    try {
      const u = await apiFetch<UserView>(`/api/users/${userId}`);
      setUser(u);
      setError(null);
    } catch (e) {
      setError(explainError(e).hint);
    } finally {
      setLoadingUser(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  if (error) {
    return (
      <div className="col" style={{ gap: 'var(--s-4)' }}>
        <button onClick={() => router.back()} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} strokeWidth={1.75} /> Назад
        </button>
        <div className="callout callout--danger"><span>{error}</span></div>
      </div>
    );
  }
  if (loadingUser || !user) return <div className="muted">Загрузка…</div>;

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 720 }}>
      <button onClick={() => router.back()} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> К списку
      </button>

      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          администрация · пользователь
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(22px, 2.4vw, 32px)', margin: 0, lineHeight: 1.2 }}>
          {user.lastName} {user.firstName} {user.middleName ?? ''}
        </h1>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="muted">{user.email}</span>
          <span className={user.isActive ? 'badge badge--ok' : 'badge badge--bad'}>
            {user.isActive ? 'активен' : 'отключён'}
          </span>
          {user.roles.map((r) => (
            <span key={r} className="badge">{ROLE_LABELS[r]}</span>
          ))}
        </div>
      </header>

      {/* Редактор ролей */}
      <RolesSection user={user} onSaved={() => void reload()} />

      {/* Привязка к сотруднику Сетевого ПОО */}
      <NetschoolEmployeeSection user={user} onSaved={() => void reload()} />
    </div>
  );
}

function RolesSection({ user, onSaved }: { user: UserView; onSaved: () => void }) {
  const { user: actor } = useAuth();
  const [picked, setPicked] = useState<Set<Role>>(new Set(user.roles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPicked(new Set(user.roles)); }, [user.roles]);

  const isSelf = actor?.id === user.id;
  const actorIsSuper = !!actor?.roles.includes('SUPERADMIN');

  function toggle(role: Role) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function disabledReason(role: Role): string | null {
    // SUPERADMIN на себе нельзя срезать
    if (role === 'SUPERADMIN' && isSelf && user.roles.includes('SUPERADMIN') && !picked.has('SUPERADMIN')) {
      return null; // toggle off — сами поймаем при сохранении? нет, лучше сразу заблокировать
    }
    if (role === 'SUPERADMIN' && isSelf && user.roles.includes('SUPERADMIN')) {
      return 'нельзя снять с себя';
    }
    // SUPERADMIN может назначать только SUPERADMIN
    if (role === 'SUPERADMIN' && !user.roles.includes('SUPERADMIN') && !actorIsSuper) {
      return 'только SUPERADMIN может назначить';
    }
    return null;
  }

  const dirty = useMemo(() => {
    const a = [...picked].sort().join(',');
    const b = [...user.roles].sort().join(',');
    return a !== b;
  }, [picked, user.roles]);

  async function save() {
    if (picked.size === 0) {
      setError('Хотя бы одна роль должна быть выбрана');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/users/${user.id}/roles`, {
        method: 'PATCH',
        body: { roles: [...picked] },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      <header className="col" style={{ gap: 4 }}>
        <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Роли</h2>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)' }}>
          После сохранения пользователь должен <b>перелогиниться</b> — список ролей
          уезжает в JWT и кэшируется до конца сессии.
        </p>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <div className="card" style={{ padding: 'var(--s-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--s-2)' }}>
          {ALL_ROLES.map((r) => {
            const disabled = disabledReason(r);
            const checked = picked.has(r);
            return (
              <label
                key={r}
                className="row"
                style={{
                  gap: 'var(--s-2)',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--ais-line)',
                  background: checked ? 'var(--ais-paper-2)' : 'transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!!disabled}
                  onChange={() => toggle(r)}
                  style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                />
                <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--fs-13)', fontWeight: 500 }}>{ROLE_LABELS[r]}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>{r}{disabled ? ` · ${disabled}` : ''}</span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="row" style={{ gap: 'var(--s-2)', justifyContent: 'flex-end', marginTop: 'var(--s-3)' }}>
          {dirty && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPicked(new Set(user.roles))} disabled={busy}>
              Откатить
            </button>
          )}
          <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={!dirty || busy}>
            {busy ? 'Сохранение…' : 'Сохранить роли'}
          </button>
        </div>
      </div>
    </section>
  );
}

function NetschoolEmployeeSection({ user, onSaved }: { user: UserView; onSaved: () => void }) {
  const [employees, setEmployees] = useState<PzaEmployee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number | null>(user.netschoolEmployeeId ?? null);

  // Загружаем список сотрудников один раз — 162 записи, помещается в DOM спокойно.
  useEffect(() => {
    apiFetch<PzaEmployee[]>('/api/poozabeduapi/employees')
      .then((es) => setEmployees(es))
      .catch((e) => setError(explainError(e).hint));
  }, []);

  // Сбрасываем pick если в БД изменилось
  useEffect(() => {
    setPicked(user.netschoolEmployeeId ?? null);
  }, [user.netschoolEmployeeId]);

  const isTea = user.roles.includes('TEA');
  const currentEmployee = useMemo(
    () => employees?.find((e) => e.id === picked) ?? null,
    [employees, picked],
  );

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = search.trim().toLocaleLowerCase('ru');
    let list = [...employees].sort((a, b) =>
      `${a.lastName ?? ''} ${a.firstName ?? ''}`.localeCompare(`${b.lastName ?? ''} ${b.firstName ?? ''}`, 'ru'),
    );
    if (q) {
      list = list.filter((e) => {
        const fio = `${e.lastName ?? ''} ${e.firstName ?? ''} ${e.middleName ?? ''}`.toLocaleLowerCase('ru');
        return fio.includes(q) || String(e.id) === q;
      });
    }
    return list;
  }, [employees, search]);

  async function save(newId: number | null) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/users/${user.id}/netschool-employee`, {
        method: 'PATCH',
        body: { netschoolEmployeeId: newId },
      });
      setPicked(newId);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  const dirty = picked !== (user.netschoolEmployeeId ?? null);

  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      <header className="col" style={{ gap: 4 }}>
        <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>
          Привязка к Сетевому ПОО
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)' }}>
          Выберите сотрудника-классного руководителя из poo.zabedu.ru. После сохранения
          пользователь должен <b>перелогиниться</b> — связь едет в JWT, и старый токен
          будет содержать прежнее значение.
          {!isTea && (
            <>
              <br /><span style={{ color: 'var(--ais-ember)' }}>
                У этого пользователя нет роли <b>TEA</b> — привязка сохранится, но
                использоваться не будет до выдачи роли.
              </span>
            </>
          )}
        </p>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
        {/* Текущая привязка */}
        <div className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Текущая привязка</span>
          {currentEmployee ? (
            <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-14)', fontWeight: 500 }}>
                {currentEmployee.lastName} {currentEmployee.firstName} {currentEmployee.middleName ?? ''}
              </span>
              <span className="mono muted" style={{ fontSize: 11 }}>#{currentEmployee.id}</span>
              {currentEmployee.positionName && (
                <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                  · {currentEmployee.positionName}
                </span>
              )}
              {currentEmployee.isFired && (
                <span className="badge badge--bad" style={{ fontSize: 11 }}>уволен</span>
              )}
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="btn btn--ghost btn--sm"
                style={{ marginLeft: 'auto' }}
                title="Снять привязку"
              >
                <X size={12} strokeWidth={1.75} /> Снять
              </button>
            </div>
          ) : picked !== null && !employees ? (
            <span className="mono muted">#{picked} (загружаю справочник…)</span>
          ) : picked !== null ? (
            <span className="mono">#{picked} (нет в текущем списке сотрудников)</span>
          ) : (
            <span className="muted">не задана</span>
          )}
        </div>

        {/* Поиск */}
        <div className="input-group">
          <Search size={14} className="icon" />
          <input
            className="input"
            placeholder="Поиск по фамилии или ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Список */}
        {!employees ? (
          <div className="muted">Загрузка справочника сотрудников…</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--ais-line)', borderRadius: 8 }}>
            {filtered.length === 0 ? (
              <div className="muted" style={{ padding: 'var(--s-3)', fontSize: 'var(--fs-13)' }}>
                ничего не нашлось
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {filtered.map((e) => {
                  const isPicked = e.id === picked;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(e.id)}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '8px 12px', border: 'none',
                          background: isPicked ? 'var(--ais-paper-2)' : 'transparent',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--ais-line)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          gap: 'var(--s-2)',
                        }}
                        className="emp-row"
                      >
                        <span style={{ fontSize: 'var(--fs-13)' }}>
                          {isPicked && <Check size={12} strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />}
                          {e.lastName ?? ''} {e.firstName ?? ''} {e.middleName ?? ''}
                          {e.isFired && (
                            <span className="badge badge--bad" style={{ fontSize: 10, marginLeft: 6 }}>уволен</span>
                          )}
                        </span>
                        <span className="mono muted" style={{ fontSize: 11 }}>
                          #{e.id}
                          {e.positionName ? ` · ${e.positionName}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Действия */}
        <div className="row" style={{ gap: 'var(--s-2)', justifyContent: 'flex-end' }}>
          {dirty && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPicked(user.netschoolEmployeeId ?? null)}
              disabled={busy}
            >
              <RotateCcw size={12} strokeWidth={1.75} /> Откатить
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => save(picked)}
            disabled={!dirty || busy}
          >
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .emp-row:hover { background: var(--ais-paper-2); }
      `}</style>
    </section>
  );
}
