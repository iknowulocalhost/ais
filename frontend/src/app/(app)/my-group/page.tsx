'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { UsersRound, Search, GraduationCap, RefreshCw } from 'lucide-react';
import { Protected } from '@/components/protected';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * /my-group — досье группы в виде бенто-grid карточек.
 *
 * Для TEA — авто-выбор его собственной (одной) группы; если у учителя
 * несколько закреплённых групп, можно переключаться через дропдаун. ADMIN/COM
 * видят все 85 групп и могут смотреть досье любой.
 *
 * Каждая карточка студента — фото-плейсхолдер с инициалами, ФИО, группа,
 * средний балл (берём из локального зеркала, обновляется ночью). Клик открывает
 * полноценное досье `/dossier/[externalId]` с паспортом/родителями/приказами.
 */

interface MirrorGroup {
  externalId: number;
  name: string;
  yearNumber: number | null;
  educationForm: string | null;
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
  gradePointAverage: number | null;
  isActive: boolean;
}

interface MirrorStudentsPage { total: number; items: MirrorStudent[] }

export default function MyGroupPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA']}>
      <MyGroupView />
    </Protected>
  );
}

function MyGroupView() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MirrorGroup[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<MirrorStudentsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 1. Грузим список групп. Для TEA это уже отфильтровано на бэке —
  //    придёт 1-2 группы, которые он курирует.
  useEffect(() => {
    apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups')
      .then((g) => {
        const active = g.filter((x) => x.isActive);
        active.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        setGroups(active);
        if (active.length > 0 && groupId === null) setGroupId(active[0].externalId);
      })
      .catch((e) => setError(explainError(e).hint));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Когда выбрана группа — тянем её студентов.
  const loadStudents = useCallback(async () => {
    if (!groupId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<MirrorStudentsPage>('/api/poozabeduapi/mirror/students', {
        query: {
          groupExternalId: groupId,
          search: search || undefined,
          isActive: 'true',
          limit: 200,
        },
      });
      setStudents(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }, [groupId, search]);

  useEffect(() => { void loadStudents(); }, [loadStudents]);

  const isTeaOnly = useMemo(() => {
    if (!user) return false;
    if (user.roles.includes('SUPERADMIN') || user.roles.includes('ADM') || user.roles.includes('COM')) return false;
    return user.roles.includes('TEA');
  }, [user]);

  const currentGroup = groups?.find((g) => g.externalId === groupId) ?? null;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            Преподаватели
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
            {isTeaOnly ? 'Моя группа' : 'Учебная группа'}
          </h1>
          {currentGroup && (
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)' }}>
              {currentGroup.name}
              {currentGroup.yearNumber !== null && ` · ${currentGroup.yearNumber} курс`}
              {students && ` · ${students.total} ${pluralizeStudents(students.total)}`}
            </p>
          )}
        </div>

        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {groups && groups.length > 1 && (
            <select
              className="input"
              value={groupId ?? ''}
              onChange={(e) => setGroupId(Number(e.target.value))}
              style={{ minWidth: 180 }}
            >
              {groups.map((g) => (
                <option key={g.externalId} value={g.externalId}>
                  {g.name}{g.yearNumber !== null ? ` · ${g.yearNumber} к.` : ''}
                </option>
              ))}
            </select>
          )}
          <div className="input-group" style={{ minWidth: 220 }}>
            <Search size={14} className="icon" />
            <input
              className="input"
              placeholder="Фамилия / имя"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {!groups ? (
        <div className="muted">Загрузка групп…</div>
      ) : groups.length === 0 ? (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
          <UsersRound size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>За вами не закреплено ни одной группы.</span>
          <p className="muted" style={{ textAlign: 'center', maxWidth: 420, fontSize: 'var(--fs-12)' }}>
            Если вы являетесь классным руководителем — обратитесь к администратору, чтобы вашему
            аккаунту привязали закреплённую группу.
          </p>
        </div>
      ) : !students || busy ? (
        <div className="muted"><RefreshCw size={14} strokeWidth={1.75} className="spin" /> Загружаем список студентов…</div>
      ) : students.items.length === 0 ? (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-2)', color: 'var(--ais-bone-3)' }}>
          <GraduationCap size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>{search ? 'Ничего не найдено.' : 'В группе пока нет студентов.'}</span>
        </div>
      ) : (
        <BentoGrid students={students.items} />
      )}

      <style jsx>{`
        :global(.spin) { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function BentoGrid({ students }: { students: MirrorStudent[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 'var(--s-3)',
    }}>
      {students.map((s) => <StudentCard key={s.externalId} s={s} />)}
    </div>
  );
}

function StudentCard({ s }: { s: MirrorStudent }) {
  const fullName = `${s.lastName} ${s.firstName} ${s.middleName ?? ''}`.trim();
  const shortName = `${s.lastName} ${s.firstName?.[0] ?? ''}.${s.middleName?.[0] ? ' ' + s.middleName[0] + '.' : ''}`;
  const initials = `${s.lastName[0] ?? ''}${s.firstName[0] ?? ''}`.toUpperCase();
  const grade = s.gradePointAverage;
  const gradeTone = grade === null ? 'muted'
                  : grade >= 4.5 ? 'ok'
                  : grade >= 4   ? 'good'
                  : grade >= 3.5 ? 'warn'
                  : 'bad';

  return (
    <Link
      href={`/dossier/${s.externalId}`}
      className="card col"
      style={{
        padding: 'var(--s-4)',
        gap: 'var(--s-3)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)',
        borderColor: 'var(--ais-line)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ais-bone-3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ais-line)'; }}
      title={fullName}
    >
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
        {/* Аватар-плейсхолдер. Когда мы научимся тянуть фото из upstream/MinIO,
            сюда поставим <img>. Пока — инициалы на цветной плашке. */}
        <div
          className="avatar"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--ais-paper-2)',
            border: '1px solid var(--ais-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--ff-mono, monospace)',
            fontSize: 18, fontWeight: 600,
            color: 'var(--ais-bone-3)',
            flexShrink: 0,
          }}
          aria-hidden
        >
          {initials || '·'}
        </div>
        <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 'var(--fs-14)', fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {shortName}
          </span>
          {s.groupName && (
            <span className="mono muted" style={{ fontSize: 11 }}>
              {s.groupName}
            </span>
          )}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span className={`badge ${gradeBadgeClass(gradeTone)}`} style={{ fontSize: 11 }}>
          {grade !== null ? grade.toFixed(2) : '—'}
        </span>
        {s.birthDate && (
          <span className="mono muted" style={{ fontSize: 11 }}>
            род. {fmtDateRu(s.birthDate)}
          </span>
        )}
      </div>
    </Link>
  );
}

function gradeBadgeClass(tone: 'ok' | 'good' | 'warn' | 'bad' | 'muted'): string {
  switch (tone) {
    case 'ok': return 'badge--ok';
    case 'good': return '';
    case 'warn': return 'badge--warn';
    case 'bad': return 'badge--bad';
    default: return '';
  }
}

function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function pluralizeStudents(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'студентов';
  if (last === 1) return 'студент';
  if (last >= 2 && last <= 4) return 'студента';
  return 'студентов';
}
