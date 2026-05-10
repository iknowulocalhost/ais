'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Printer } from 'lucide-react';
import { Protected } from '@/components/protected';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { REPORT_KIND_LABELS, type ReportExport, type ReportKind } from '@/lib/domain';
import { useBackgroundJobs } from '@/components/background-jobs';

/**
 * Отчёты. Интеграция с фоновыми задачами:
 *   · enqueue(id) при POST /reports/exports
 *   · finish(id, {ok, action}) при переходе в READY/FAILED
 */

export default function ReportsPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'ADMINISTRATION', 'COM', 'TEA']}>
      <ReportsView />
    </Protected>
  );
}

const STATUS_VARIANT: Record<ReportExport['status'], string> = {
  QUEUED: '',
  RUNNING: 'badge--warn',
  READY: 'badge--ok',
  FAILED: 'badge--bad',
};

const STATUS_LABEL: Record<ReportExport['status'], string> = {
  QUEUED: 'в очереди',
  RUNNING: 'формируется',
  READY: 'готов',
  FAILED: 'ошибка',
};

function ReportsView() {
  const [kind, setKind] = useState<ReportKind>('STUDENTS_ROSTER');
  const [tracked, setTracked] = useState<ReportExport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueing, setQueueing] = useState(false);
  const pollRef = useRef<number | null>(null);
  const notified = useRef<Set<string>>(new Set());
  const jobs = useBackgroundJobs();

  const tick = useCallback(async () => {
    const pending = tracked.filter((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (pending.length === 0) return;
    try {
      const updated = await Promise.all(
        pending.map((r) => apiFetch<ReportExport>(`/api/reports/exports/${r.id}`)),
      );
      setTracked((prev) => prev.map((r) => updated.find((u) => u.id === r.id) ?? r));

      for (const u of updated) {
        const terminal = u.status === 'READY' || u.status === 'FAILED';
        if (terminal && !notified.current.has(u.id)) {
          notified.current.add(u.id);
          jobs.finish(u.id, {
            ok: u.status === 'READY',
            action: u.status === 'READY' && u.downloadUrl
              ? { label: 'скачать xlsx', href: u.downloadUrl }
              : undefined,
            reason: u.errorMessage ?? undefined,
          });
        }
      }
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [tracked, jobs]);

  useEffect(() => {
    const hasPending = tracked.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (!hasPending) {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current === null) {
      pollRef.current = window.setInterval(() => void tick(), 2000);
    }
    return () => {
      if (pollRef.current !== null && !hasPending) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [tracked, tick]);

  async function requestExport() {
    setError(null);
    setQueueing(true);
    try {
      const created = await apiFetch<ReportExport>('/api/reports/exports', {
        method: 'POST',
        body: { kind, params: {} },
      });
      setTracked((prev) => [created, ...prev]);
      jobs.enqueue({
        id: created.id,
        kind: 'report-export',
        title: REPORT_KIND_LABELS[created.kind],
      });
    } catch (e) {
      setError(explainError(e).hint);
    } finally {
      setQueueing(false);
    }
  }

  return (
    <div className="col" style={{ gap: 'var(--s-6)' }}>
      <header
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--s-5)',
          borderBottom: '1px solid var(--ais-line)',
          paddingBottom: 'var(--s-5)',
        }}
      >
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)' }}>Ведомости и отчёты</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-13)', maxWidth: '64ch' }}>
            Формирование академических отчётов: рейтинги групп, аттестационные ведомости,
            посещаемость. Готовый отчёт можно отправить на печать.
          </p>
        </div>
      </header>

      <PoozabeduReportsSection />

      {/* NEW EXPORT */}
      <section className="card">
        <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          Выгрузка реестров — XLSX
        </span>
        <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 4, marginBottom: 0 }}>
          Большие выгрузки готовятся в фоне. О готовности уведомим в правом нижнем углу.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--s-3)', marginTop: 'var(--s-4)' }}>
          <label className="field" style={{ minWidth: 260 }}>
            <span className="field__label">тип отчёта</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ReportKind)}
              className="input"
            >
              {(Object.keys(REPORT_KIND_LABELS) as ReportKind[]).map((k) => (
                <option key={k} value={k}>{REPORT_KIND_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <button
            className="btn btn--primary"
            onClick={() => void requestExport()}
            disabled={queueing}
          >
            {queueing ? 'в очередь…' : 'Поставить в очередь →'}
          </button>
        </div>
      </section>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {/* TRACKED LIST */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <header
          className="row"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--s-4) var(--s-5)',
            borderBottom: '1px solid var(--ais-line)',
          }}
        >
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            запросы в этой сессии
          </span>
          <span className="mono tnum muted" style={{ fontSize: 11 }}>
            {tracked.length} шт.
          </span>
        </header>

        {tracked.length === 0 ? (
          <div style={{ padding: 'var(--s-8) var(--s-5)', textAlign: 'center' }}>
            <span className="mono muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              пусто
            </span>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tracked.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                className="row"
                style={{
                  alignItems: 'center',
                  gap: 'var(--s-4)',
                  padding: 'var(--s-3) var(--s-5)',
                  borderBottom: '1px solid var(--ais-line)',
                }}
              >
                <StatusGlyph status={r.status} />
                <div className="col" style={{ minWidth: 0, flex: 1, gap: 2 }}>
                  <div style={{ fontSize: 'var(--fs-14)', color: 'var(--ais-bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {REPORT_KIND_LABELS[r.kind]}
                  </div>
                  <div className="mono muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    id {r.id.slice(0, 8)} · {new Date(r.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    {r.errorMessage && ` · ${r.errorMessage}`}
                  </div>
                </div>
                <span className={`badge ${STATUS_VARIANT[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                {r.status === 'READY' && r.downloadUrl && (
                  <a href={r.downloadUrl} download className="btn btn--primary btn--sm">
                    скачать xlsx ↓
                  </a>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ────────── Сетевой ПОО — отчёты ──────────

interface PzaGroup {
  externalId: number;
  name: string;
  yearNumber: number | null;
  departmentExternalId: number | null;
  isActive: boolean;
}
interface PzaDepartment { externalId: number; name: string; isActive: boolean }

type ReportNeeds = 'group' | 'group+term';
interface ReportType { id: string; label: string; needs: ReportNeeds; description: string }

const REPORT_TYPES: ReportType[] = [
  {
    id: 'group-attestation',
    label: 'Аттестационная ведомость',
    needs: 'group+term',
    description: 'Отметки и зачёты за выбранный семестр.',
  },
  {
    id: 'current-progress',
    label: 'Текущая успеваемость',
    needs: 'group+term',
    description: 'Текущие отметки в течение семестра — по каждому предмету.',
  },
  {
    id: 'attendance',
    label: 'Посещаемость',
    needs: 'group+term',
    description: 'Пропуски уроков по уважительной и неуважительной причинам.',
  },
  {
    id: 'rating',
    label: 'Рейтинг группы',
    needs: 'group+term',
    description: 'Сводный рейтинг по аттестации и пропускам — для классного часа.',
  },
  {
    id: 'debts',
    label: 'Список задолженностей',
    needs: 'group+term',
    description: 'Студенты, имеющие хотя бы одно «не аттестован» по итогам семестра.',
  },
  {
    id: 'group-students',
    label: 'Список учебной группы',
    needs: 'group',
    description: 'Алфавитный реестр студентов группы.',
  },
];

function PoozabeduReportsSection() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<PzaGroup[] | null>(null);
  const [departments, setDepartments] = useState<PzaDepartment[] | null>(null);
  const [reportId, setReportId] = useState<ReportType['id']>('group-attestation');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [term, setTerm] = useState<number>(new Date().getMonth() < 8 ? 2 : 1);
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    apiFetch<PzaGroup[]>('/api/poozabeduapi/mirror/groups')
      .then((g) => {
        const active = g.filter((x) => x.isActive)
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        setGroups(active);
        if (active.length > 0) setGroupId(active[0].externalId);
      })
      .catch(() => setGroups([]));
    apiFetch<PzaDepartment[]>('/api/poozabeduapi/mirror/departments')
      .then((d) => setDepartments(d.filter((x) => x.isActive)))
      .catch(() => setDepartments([]));
  }, []);

  const reportType = useMemo(
    () => REPORT_TYPES.find((r) => r.id === reportId) ?? REPORT_TYPES[0],
    [reportId],
  );

  // Все курсы, реально встречающиеся в активных группах — для селекта.
  const availableYears = useMemo(() => {
    if (!groups) return [];
    const set = new Set<number>();
    for (const g of groups) if (g.yearNumber !== null) set.add(g.yearNumber);
    return [...set].sort((a, b) => a - b);
  }, [groups]);

  // Применяем фильтры к списку групп.
  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    const q = groupSearch.trim().toLowerCase();
    return groups.filter((g) => {
      if (departmentId !== '' && g.departmentExternalId !== departmentId) return false;
      if (yearFilter !== '' && g.yearNumber !== yearFilter) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [groups, departmentId, yearFilter, groupSearch]);

  // Если текущая выбранная группа отфильтровалась — переключаемся на первую видимую.
  useEffect(() => {
    if (groupId === '' || filteredGroups.length === 0) return;
    if (!filteredGroups.some((g) => g.externalId === groupId)) {
      setGroupId(filteredGroups[0].externalId);
    }
  }, [filteredGroups, groupId]);

  function openReport() {
    if (!groupId) return;
    const qs = new URLSearchParams({ type: reportType.id, groupId: String(groupId) });
    if (reportType.needs === 'group+term') {
      qs.set('term', String(term));
      qs.set('date', endDate);
    }
    window.open(`/reports/print?${qs.toString()}`, '_blank', 'noopener');
  }

  function resetFilters() {
    setDepartmentId('');
    setYearFilter('');
    setGroupSearch('');
  }

  const isTeaOnly =
    !!user?.roles.includes('TEA') &&
    !user.roles.includes('SUPERADMIN') && !user.roles.includes('ADM') && !user.roles.includes('COM');

  return (
    <section className="card col" style={{ gap: 'var(--s-4)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
        <div className="col" style={{ gap: 4 }}>
          <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            Академические отчёты
          </span>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-12)' }}>
            {isTeaOnly
              ? 'Доступны отчёты по вашей группе.'
              : 'Доступны отчёты по любой группе техникума. Используйте фильтры, чтобы быстро найти нужную.'}
          </p>
        </div>
      </header>

      {/* ── Тип отчёта ── */}
      <div className="col" style={{ gap: 'var(--s-2)' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Тип отчёта</span>
        <select className="input" value={reportId} onChange={(e) => setReportId(e.target.value)}>
          {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>{reportType.description}</span>
      </div>

      {/* ── Фильтры по группам ── */}
      {!isTeaOnly && (groups?.length ?? 0) > 1 && (
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
              Фильтры
            </span>
            {(departmentId !== '' || yearFilter !== '' || groupSearch) && (
              <button onClick={resetFilters} className="btn btn--ghost btn--sm" type="button">Сбросить</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--s-3)' }}>
            <label className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Отделение</span>
              <select
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Все отделения</option>
                {departments?.map((d) => (
                  <option key={d.externalId} value={d.externalId}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Курс</span>
              <select
                className="input"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Все курсы</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y} курс</option>
                ))}
              </select>
            </label>
            <label className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Поиск группы</span>
              <input
                type="text"
                className="input"
                placeholder="например, КС-21"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}

      {/* ── Параметры отчёта ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--s-3)' }}>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Группа</span>
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">—</option>
            {filteredGroups.map((g) => (
              <option key={g.externalId} value={g.externalId}>
                {g.name}{g.yearNumber !== null ? ` · ${g.yearNumber} к.` : ''}
              </option>
            ))}
          </select>
          {filteredGroups.length === 0 && groups && groups.length > 0 && (
            <span className="muted" style={{ fontSize: 11 }}>По выбранным фильтрам групп не найдено</span>
          )}
        </label>
        {reportType.needs === 'group+term' && (
          <>
            <label className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Семестр</span>
              <select className="input" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
                <option value={1}>I семестр (осень)</option>
                <option value={2}>II семестр (весна)</option>
              </select>
            </label>
            <label className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>На дату</span>
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn--primary btn--sm" onClick={openReport} disabled={!groupId}>
          <Printer size={14} strokeWidth={1.75} /> Открыть ведомость
        </button>
        <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
          Откроется в новой вкладке, оттуда можно отправить документ на печать.
        </span>
      </div>
    </section>
  );
}

function StatusGlyph({ status }: { status: ReportExport['status'] }) {
  if (status === 'RUNNING') {
    return (
      <motion.span
        aria-hidden
        style={{
          height: 10,
          width: 10,
          borderRadius: '50%',
          border: '1.5px solid var(--ais-forest)',
          borderRightColor: 'transparent',
        }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
      />
    );
  }
  const bg =
    status === 'READY' ? 'var(--ais-forest)' :
    status === 'FAILED' ? 'var(--ais-ember)' :
    'var(--ais-line-strong)';
  return (
    <span
      aria-hidden
      style={{ display: 'block', height: 10, width: 10, borderRadius: '50%', background: bg }}
    />
  );
}
