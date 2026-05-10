'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Printer, RefreshCw } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * Массовое создание учёток студентов целой группы.
 *
 * Идемпотентно: если у студента уже была учётка — она сохраняется, пароль не
 * пересоздаётся (видим «уже существует»). У свежесозданных пароль показывается
 * один раз — отсюда ведомость можно сразу распечатать и раздать студентам.
 */

interface MirrorGroup {
  externalId: number;
  name: string;
  yearNumber: number | null;
  isActive: boolean;
}

interface BulkAccountRow {
  studentExternalId: number;
  fullName: string;
  groupName: string | null;
  email: string;
  password: string | null;
  created: boolean;
}

export default function BulkPasswordsPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM']}>
      <BulkPasswordsView />
    </Protected>
  );
}

function BulkPasswordsView() {
  const [groups, setGroups] = useState<MirrorGroup[] | null>(null);
  const [groupId, setGroupId] = useState<number | ''>('');
  const [rows, setRows] = useState<BulkAccountRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups')
      .then((g) => setGroups(g.filter((x) => x.isActive)))
      .catch(() => setGroups([]));
  }, []);

  const groupsSorted = useMemo(() => {
    if (!groups) return [];
    return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [groups]);

  const currentGroup = groups?.find((g) => g.externalId === groupId) ?? null;

  async function generate() {
    if (!groupId) return;
    setBusy(true);
    setErrorText(null);
    setRows(null);
    try {
      const r = await apiFetch<{ items: BulkAccountRow[] }>(
        `/api/users/groups/${groupId}/accounts`,
        { method: 'POST' },
      );
      setRows(r.items);
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  const newCount = rows?.filter((r) => r.created).length ?? 0;
  const existingCount = rows ? rows.length - newCount : 0;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <Link href="/dossier" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> К списку студентов
      </Link>

      <header className="col" style={{ gap: 'var(--s-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
          Учебная часть
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
          Массовое создание паролей
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)', maxWidth: 700 }}>
          Выберите группу, нажмите «Сгенерировать» — для всех студентов без аккаунта в АИС
          будут созданы учётки и сгенерированы пароли. Существующие аккаунты не затрагиваются.
          Пароли отображаются один раз — распечатайте ведомость и раздайте студентам.
        </p>
      </header>

      {errorText && <div className="callout callout--danger"><span>{errorText}</span></div>}

      <div className="card row" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="input"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ minWidth: 240 }}
        >
          <option value="">Выберите группу</option>
          {groupsSorted.map((g) => (
            <option key={g.externalId} value={g.externalId}>
              {g.name}{g.yearNumber !== null ? ` · ${g.yearNumber} к.` : ''}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={!groupId || busy}
          className="btn btn--primary btn--sm"
          type="button"
        >
          {busy ? <RefreshCw size={14} strokeWidth={1.75} className="spin" /> : <KeyRound size={14} strokeWidth={1.75} />}
          {busy ? 'Генерируем…' : 'Сгенерировать'}
        </button>
        {rows && (
          <button onClick={() => window.print()} className="btn btn--ghost btn--sm no-print" type="button">
            <Printer size={14} strokeWidth={1.75} /> Печать ведомости
          </button>
        )}
      </div>

      {rows && (
        <>
          <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 'var(--fs-14)' }}>
              Группа <b>{currentGroup?.name ?? '—'}</b>:
            </span>
            <span className="badge badge--ok" style={{ fontSize: 11 }}>создано {newCount}</span>
            <span className="badge" style={{ fontSize: 11 }}>уже было {existingCount}</span>
          </div>

          <div className="card card--bleed print-area">
            <table className="table bulk-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>№</th>
                  <th>ФИО</th>
                  <th>Логин</th>
                  <th>Пароль</th>
                  <th className="no-print">Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.studentExternalId}>
                    <td className="mono muted">{i + 1}</td>
                    <td>{r.fullName}</td>
                    <td className="mono">{r.email}</td>
                    <td className="mono" style={{ fontWeight: r.password ? 600 : undefined }}>
                      {r.password ?? <span className="muted">—</span>}
                    </td>
                    <td className="no-print">
                      {r.created ? (
                        <span className="badge badge--ok" style={{ fontSize: 11 }}>создан</span>
                      ) : (
                        <span className="badge" style={{ fontSize: 11 }}>уже был</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ fontSize: 'var(--fs-12)', maxWidth: 700 }}>
            Пароли показываются один раз. Если страница закроется, восстановить их нельзя —
            нужно будет сбрасывать пароль у каждого студента из его карточки.
          </p>
        </>
      )}

      <style jsx global>{`
        :global(.spin) { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          /* На бумагу уходит ТОЛЬКО таблица — без шапки страницы, без подписей,
             без бейджей и пояснений. Логин-пароль и всё. */
          .app-shell aside, .app-shell .app-header, .no-print,
          header, h1, p, .callout, .badge, .row { display: none !important; }
          .print-area { display: block !important; }
          body, .app-main { background: #fff !important; color: #000 !important; padding: 0 !important; }
          .bulk-table { font-size: 10pt; width: 100%; border-collapse: collapse; }
          .bulk-table th, .bulk-table td { border: 1px solid #000 !important; padding: 4px 6px; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
