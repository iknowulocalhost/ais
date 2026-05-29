'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, User } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

/** Пикер студента из зеркала Сетевого ПОО (`/api/poozabeduapi/mirror/*`): группа + debounced поиск. */

export interface PickedStudent {
  externalId: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string | null;
  groupExternalId: number | null;
  groupName: string | null;
}

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
  groupExternalId: number | null;
  groupName: string | null;
  isActive: boolean;
}

interface MirrorStudentsPage {
  total: number;
  items: MirrorStudent[];
}

interface StudentPickerProps {
  value: PickedStudent | null;
  onChange: (s: PickedStudent | null) => void;
  /** Подсветить, если родитель показал, что студент обязателен. */
  required?: boolean;
}

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_MIN_CHARS = 2;
const SEARCH_LIMIT = 20;

export function StudentPicker({ value, onChange, required }: StudentPickerProps) {
  const [groups, setGroups] = useState<MirrorGroup[] | null>(null);
  const [groupFilter, setGroupFilter] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<MirrorStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Группы — грузим один раз
  useEffect(() => {
    apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups')
      .then((g) => setGroups(g.filter((x) => x.isActive)))
      .catch(() => setGroups([]));
  }, []);

  // Закрывать выпадайку по клику вне
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced-поиск
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < SEARCH_MIN_CHARS && !groupFilter) {
      setResults(null);
      return;
    }
    setBusy(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await apiFetch<MirrorStudentsPage>('/api/poozabeduapi/mirror/students', {
          query: {
            search: search.trim() || undefined,
            groupExternalId: groupFilter || undefined,
            limit: SEARCH_LIMIT,
            isActive: 'true',
          },
        });
        setResults(r.items);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Ошибка поиска');
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, groupFilter]);

  function pick(s: MirrorStudent) {
    onChange({
      externalId: s.externalId,
      lastName: s.lastName,
      firstName: s.firstName,
      middleName: s.middleName,
      birthDate: s.birthDate ? s.birthDate.slice(0, 10) : null,
      groupExternalId: s.groupExternalId,
      groupName: s.groupName,
    });
    setSearch('');
    setResults(null);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setSearch('');
    setResults(null);
  }

  const groupsByYear = useMemo(() => {
    if (!groups) return [];
    const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return sorted;
  }, [groups]);

  return (
    <div ref={wrapperRef} className="col" style={{ gap: 'var(--s-2)' }}>
      {/* Фильтр по группе */}
      <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="input"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ flex: '0 0 auto', minWidth: 180 }}
        >
          <option value="">Все группы</option>
          {groupsByYear.map((g) => (
            <option key={g.externalId} value={g.externalId}>
              {g.name}
            </option>
          ))}
        </select>

        {/* Сам выбранный студент */}
        {value ? (
          <div className="row" style={{
            gap: 'var(--s-2)', alignItems: 'center', flex: 1, minWidth: 0,
            padding: '6px 10px', borderRadius: 8,
            background: 'var(--ais-paper-2)', border: '1px solid var(--ais-line)',
          }}>
            <User size={14} strokeWidth={1.75} />
            <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--fs-13)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {value.lastName} {value.firstName} {value.middleName ?? ''}
              </span>
              {value.groupName && (
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {value.groupName}
                </span>
              )}
            </div>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={clear} title="Сбросить">
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
            <Search size={14} className="icon" />
            <input
              className="input"
              placeholder="Фамилия студента (от 2 символов)"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              required={required}
              aria-required={required || undefined}
            />
          </div>
        )}
      </div>

      {/* Выпадайка результатов */}
      {!value && open && (results !== null || busy || error) && (
        <div
          className="card"
          style={{
            padding: 0, maxHeight: 280, overflowY: 'auto',
            borderColor: 'var(--ais-line-2)',
          }}
        >
          {busy && (
            <div className="muted" style={{ padding: 'var(--s-3)', fontSize: 'var(--fs-13)' }}>
              ищу…
            </div>
          )}
          {!busy && error && (
            <div style={{ padding: 'var(--s-3)', color: 'var(--ais-ember)', fontSize: 'var(--fs-13)' }}>
              {error}
            </div>
          )}
          {!busy && results && results.length === 0 && (
            <div className="muted" style={{ padding: 'var(--s-3)', fontSize: 'var(--fs-13)' }}>
              ничего не нашлось
            </div>
          )}
          {!busy && results && results.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map((s) => (
                <li key={s.externalId}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '8px 12px', border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      borderBottom: '1px solid var(--ais-line)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 'var(--s-3)',
                    }}
                    className="picker-item"
                  >
                    <span style={{ fontSize: 'var(--fs-13)' }}>
                      {s.lastName} {s.firstName} {s.middleName ?? ''}
                    </span>
                    <span className="mono muted" style={{ fontSize: 11 }}>
                      {s.groupName ?? '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .picker-item:hover { background: var(--ais-paper-2); }
      `}</style>
    </div>
  );
}
