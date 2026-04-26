'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import {
  STUDENT_STATUS_LABELS,
  type Student,
  type StudentStatus,
} from '@/lib/domain';
import { clsx } from '@/components/clsx';

/**
 * /students — список в режиме «сетки».
 * ФИО и табличные данные — mono (JetBrains Mono); пилюли цветные только для EXPELLED.
 * «/» фокусирует поиск.
 */

interface Page { items: Student[]; total: number }

const STATUS_VARIANT: Record<StudentStatus, string> = {
  APPLICANT: '',
  ENROLLED: '',
  ACADEMIC_LEAVE: 'badge--warn',
  EXPELLED: 'badge--bad',
  GRADUATED: 'badge--ok',
};

const GRID_COLS = '28px 1.2fr 0.7fr 0.7fr 140px 22px';

export default function StudentsPage() {
  return (
    <Protected roles={['ADM', 'TEA', 'COM', 'ANA']}>
      <StudentsList />
    </Protected>
  );
}

function StudentsList() {
  const [status, setStatus] = useState<StudentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState<number>(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<Page>('/api/students', {
        query: { status: status || undefined, search: search || undefined, limit: 100 },
      });
      setData(d);
    } catch (e) {
      setError(explainError(e).hint);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const rows = data?.items ?? [];

  return (
    <div className="col" style={{ gap: 'var(--s-6)' }}>
      {/* header */}
      <section
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--s-5)',
          borderBottom: '1px solid var(--ais-line)',
          paddingBottom: 'var(--s-5)',
        }}
      >
        <div className="row" style={{ alignItems: 'baseline', gap: 'var(--s-3)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Студенты</h1>
          {data && (
            <span className="mono muted tnum" style={{ fontSize: 'var(--fs-13)' }}>
              · {data.total} чел.
            </span>
          )}
        </div>

        <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--s-2)' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по ФИО, email…"
              className="input"
              style={{ width: 260, paddingRight: 'var(--s-7)' }}
            />
            <kbd
              className="kbd"
              style={{ position: 'absolute', right: 'var(--s-2)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              /
            </kbd>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus | '')}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="">все статусы</option>
            {(Object.keys(STUDENT_STATUS_LABELS) as StudentStatus[]).map((s) => (
              <option key={s} value={s}>{STUDENT_STATUS_LABELS[s].toLowerCase()}</option>
            ))}
          </select>
          <button className="btn btn--outline">+ студент</button>
        </div>
      </section>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {/* grid */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            alignItems: 'center',
            gap: 'var(--s-4)',
            padding: 'var(--s-3) var(--s-5)',
            borderBottom: '1px solid var(--ais-line)',
            background: 'var(--ais-sub)',
          }}
        >
          {['№', 'фио', 'группа', 'д.р.', 'статус'].map((h) => (
            <span key={h} className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
              {h}
            </span>
          ))}
          <span />
        </div>

        {loading && !data ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyState onReset={() => { setSearch(''); setStatus(''); }} />
        ) : (
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((s, i) => {
              const anomaly = s.status === 'EXPELLED';
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.012 }}
                  onMouseEnter={() => setFocusIdx(i)}
                >
                  <Link
                    href={`/students/${s.id}`}
                    className={clsx('row')}
                    style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: GRID_COLS,
                      alignItems: 'center',
                      gap: 'var(--s-4)',
                      padding: 'var(--s-3) var(--s-5)',
                      borderBottom: '1px solid var(--ais-line)',
                      background: focusIdx === i ? 'var(--ais-sub)' : 'transparent',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    {anomaly && (
                      <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: 2, background: 'var(--ais-ember)' }} />
                    )}

                    <span className="mono tnum muted" style={{ fontSize: 11 }}>
                      {String(i + 1).padStart(3, '0')}
                    </span>

                    <span
                      className="mono"
                      style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {s.lastName} {s.firstName} {s.middleName ?? ''}
                    </span>

                    <span className="mono" style={{ fontSize: 'var(--fs-13)', color: 'var(--ais-bone-2)' }}>
                      {s.groupId ? shortId(s.groupId) : '—'}
                    </span>

                    <span className="mono tnum" style={{ fontSize: 'var(--fs-13)', color: 'var(--ais-bone-2)' }}>
                      {fmtBirth(s.birthDate)}
                    </span>

                    <span className={`badge ${STATUS_VARIANT[s.status]}`}>
                      {STUDENT_STATUS_LABELS[s.status]}
                    </span>

                    <span className="mono muted" style={{ fontSize: 12 }}>→</span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {data && rows.length > 0 && (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            {rows.length} из {data.total}
          </span>
          <span className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            / — фокус поиск · ↵ — открыть карточку
          </span>
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            alignItems: 'center',
            gap: 'var(--s-4)',
            padding: 'var(--s-4) var(--s-5)',
            borderBottom: '1px solid var(--ais-line)',
          }}
        >
          <span style={{ height: 10, borderRadius: 2, background: 'var(--ais-sub)' }} />
          <span style={{ height: 12, borderRadius: 2, background: 'var(--ais-sub)' }} />
          <span style={{ height: 10, borderRadius: 2, background: 'var(--ais-sub)' }} />
          <span style={{ height: 10, borderRadius: 2, background: 'var(--ais-sub)' }} />
          <span style={{ height: 20, width: 100, borderRadius: 'var(--r-pill)', background: 'var(--ais-sub)' }} />
          <span />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="col" style={{ alignItems: 'center', gap: 'var(--s-2)', padding: 'var(--s-8) var(--s-5)', textAlign: 'center' }}>
      <span style={{ fontSize: 56, lineHeight: 1, color: 'var(--ais-bone-4)' }}>∅</span>
      <p style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone-2)' }}>
        Студентов с такими параметрами не нашлось.
      </p>
      <button onClick={onReset} className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--s-2)' }}>
        ← сбросить фильтры
      </button>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function fmtBirth(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}
