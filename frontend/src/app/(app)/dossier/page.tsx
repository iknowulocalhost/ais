'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Search, ChevronLeft, ChevronRight, KeyRound } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * Досье студентов (Сетевой ПОО). Список + поиск + фильтр по группе.
 *
 * RBAC задаётся бэком:
 *  - COM/ADM/SUPERADMIN — видят всех 1831.
 *  - TEA — видит только своих (по `users.netschool_employee_id` ↔ `curator_external_id`).
 *  - STU — сюда не пускает Protected.
 */

interface MirrorGroup {
  externalId: number;
  name: string;
  yearNumber: number | null;
  isActive: boolean;
}

interface MirrorStudent {
  externalId: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string | null;
  gender: string | null;
  groupExternalId: number | null;
  groupName: string | null;
  educationBasis: string | null;
  isActive: boolean;
}

interface MirrorStudentsPage {
  total: number;
  items: MirrorStudent[];
}

const PAGE_SIZE = 50;

export default function DossierListPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA']}>
      <DossierList />
    </Protected>
  );
}

function DossierList() {
  const [groups, setGroups] = useState<MirrorGroup[] | null>(null);
  const [groupFilter, setGroupFilter] = useState<number | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<MirrorStudentsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Группы — для фильтра (бэк возвращает только свои для TEA)
  useEffect(() => {
    apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups')
      .then((g) => setGroups(g.filter((x) => x.isActive)))
      .catch(() => setGroups([]));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await apiFetch<MirrorStudentsPage>('/api/poozabeduapi/mirror/students', {
        query: {
          search: search || undefined,
          groupExternalId: groupFilter || undefined,
          isActive: 'true',
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      });
      setData(r);
    } catch (e) {
      setError(explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }, [search, groupFilter, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [search, groupFilter]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  const groupsSorted = useMemo(() => {
    if (!groups) return [];
    return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [groups]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          Учебная часть
        </div>
        <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
            Студенты
          </h1>
          <Link href="/dossier/passwords" className="btn btn--ghost btn--sm">
            <KeyRound size={14} strokeWidth={1.75} /> Массовое создание паролей
          </Link>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)', maxWidth: 600 }}>
          Карточки студентов техникума: паспортные данные, состав семьи, история приказов.
          Внутри карточки — управление аккаунтом для входа в АИС.
        </p>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={applySearch} className="row" style={{ gap: 'var(--s-2)' }}>
          <div className="input-group" style={{ minWidth: 240 }}>
            <Search size={14} className="icon" />
            <input
              className="input"
              placeholder="Фамилия / имя"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--ghost btn--sm">Найти</button>
        </form>

        <select
          className="input"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ minWidth: 200 }}
        >
          <option value="">Все группы</option>
          {groupsSorted.map((g) => (
            <option key={g.externalId} value={g.externalId}>
              {g.name}{g.yearNumber !== null ? ` · ${g.yearNumber} к.` : ''}
            </option>
          ))}
        </select>

        {data && (
          <span className="mono muted" style={{ marginLeft: 'auto' }}>
            всего: <span className="tnum">{data.total}</span>
          </span>
        )}
      </div>

      {!data && busy ? (
        <div className="muted">Загрузка…</div>
      ) : data && data.items.length === 0 ? (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
          <GraduationCap size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>
            {groupFilter || search ? 'Ничего не найдено' : 'Нет доступных студентов'}
          </span>
        </div>
      ) : data ? (
        <>
          <div className="card card--bleed">
            <table className="table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Группа</th>
                  <th>Дата рожд.</th>
                  <th>Основа</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.externalId}>
                    <td>
                      <Link href={`/dossier/${s.externalId}`} className="link">
                        {s.lastName} {s.firstName} {s.middleName ?? ''}
                      </Link>
                    </td>
                    <td className="mono">{s.groupName ?? '—'}</td>
                    <td className="mono muted">
                      {s.birthDate ? fmtDateRu(s.birthDate) : '—'}
                    </td>
                    <td className="muted" style={{ fontSize: 'var(--fs-13)' }}>
                      {educationBasisLabel(s.educationBasis)}
                    </td>
                    <td>
                      <Link href={`/dossier/${s.externalId}`} className="btn btn--ghost btn--sm">
                        Открыть досье
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-3)', alignItems: 'center' }}>
              <button className="btn btn--ghost btn--sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft size={14} strokeWidth={1.75} /> Назад
              </button>
              <span className="mono muted">{page + 1} / {totalPages}</span>
              <button className="btn btn--ghost btn--sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Далее <ChevronRight size={14} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function educationBasisLabel(v: string | null): string {
  switch (v) {
    case 'FederalBudget': return 'бюджет (ФБ)';
    case 'RegionalBudget': return 'бюджет (РБ)';
    case 'NaturalPerson': return 'договор';
    case 'LegalPerson': return 'договор (юр.)';
    case null: return '—';
    default: return v ?? '—';
  }
}
