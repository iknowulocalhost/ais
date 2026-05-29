'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, Plus, X, Eye, Upload } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { StudentPicker, type PickedStudent } from '@/components/student-picker';
import { useAuth } from '@/lib/auth-context';
import { isStudentOnly } from '@/lib/role-helpers';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Hostel = 'NONE' | 'H1' | 'H2' | 'H3';

interface PassRow {
  id: string;
  fullName: string;
  groupOrPosition: string;
  hostel: Hostel;
  status: Status;
  statusComment: string | null;
  ticketKey: string | null;
  createdAt: string;
}

interface PassesPage {
  total: number;
  items: PassRow[];
}

interface CommentOption {
  id: string;
  title: string;
  text: string;
  isDefault: boolean;
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'В работе',
  APPROVED: 'Выдан',
  REJECTED: 'Отклонён',
};
const STATUS_VARIANT: Record<Status, string> = {
  PENDING: 'badge--warn',
  APPROVED: 'badge--ok',
  REJECTED: 'badge--bad',
};
const HOSTEL_LABELS: Record<Hostel, string> = {
  NONE: 'Нет',
  H1: 'Общежитие 1',
  H2: 'Общежитие 2',
  H3: 'Общежитие 3',
};

const PAGE_SIZE = 25;

export default function PassesPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA', 'STU']}>
      <PassesView />
    </Protected>
  );
}

function PassesView() {
  const { user } = useAuth();
  const studentMode = isStudentOnly(user);
  const [filter, setFilter] = useState<Status | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PassesPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prefillStudent, setPrefillStudent] = useState<PickedStudent | null>(null);
  const [comments, setComments] = useState<CommentOption[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Заход с `?orderFor=<externalId>` (TEA из досье) — подгружаем карточку и
  // сразу открываем форму с предзаполненным студентом.
  useEffect(() => {
    const orderFor = searchParams?.get('orderFor');
    if (!orderFor) return;
    const id = Number(orderFor);
    if (!Number.isFinite(id) || id <= 0) return;
    apiFetch<{
      id: number; firstName: string; lastName: string; middleName?: string;
      studentGroup?: { id?: number; name?: string };
    }>(`/api/poozabeduapi/students/${id}`)
      .then((d) => {
        setPrefillStudent({
          externalId: d.id,
          lastName: d.lastName,
          firstName: d.firstName,
          middleName: d.middleName ?? null,
          birthDate: null,
          groupExternalId: d.studentGroup?.id ?? null,
          groupName: d.studentGroup?.name ?? null,
        });
        setShowForm(true);
        router.replace('/passes');
      })
      .catch(() => { /* fall through */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<PassesPage>('/api/passes', {
        query: {
          status: filter || undefined,
          search: search || undefined,
          createdFrom: createdFrom || undefined,
          createdTo: createdTo || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      });
      setData(d);
    } catch (e) {
      setError(explainError(e).hint);
    }
  }, [filter, search, createdFrom, createdTo, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiFetch<CommentOption[]>('/api/comment-options').then(setComments).catch(() => setComments([]));
  }, []);

  // Сбрасываем страницу при смене фильтра/поиска, чтобы не остаться на пустой странице
  useEffect(() => { setPage(0); }, [filter, search, createdFrom, createdTo]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  async function decide(id: string, decision: 'APPROVE' | 'REJECT' | 'RESET') {
    let body: Record<string, unknown> = { decision };
    if (decision === 'REJECT') {
      const reason = pickComment('Причина отказа:', comments);
      if (!reason) return;
      body = { decision, comment: reason };
    } else if (decision === 'APPROVE') {
      const note = pickComment('Комментарий (необязательно):', comments, true);
      if (note) body = { decision, approveComment: note };
    }
    setBusy(id);
    try {
      await apiFetch(`/api/passes/${id}/status`, { method: 'POST', body });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  }

  async function viewTicket(id: string) {
    try {
      const r = await apiFetch<{ url: string | null }>(`/api/passes/${id}/ticket-url`);
      if (r.url) window.open(r.url, '_blank', 'noopener');
      else alert('Квитанция не загружена');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            {studentMode ? 'мои заявки' : 'учебная часть'}
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
            Пропуска в общежитие
          </h1>
        </div>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {!studentMode && (
            <>
              <form onSubmit={applySearch} className="row" style={{ gap: 'var(--s-2)' }}>
                <input
                  className="input"
                  placeholder="Поиск по ФИО / группе"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{ width: 220 }}
                />
                <button type="submit" className="btn btn--ghost btn--sm">Найти</button>
              </form>
              <select value={filter} onChange={(e) => setFilter(e.target.value as Status | '')} className="input" style={{ width: 'auto' }}>
                <option value="">Все статусы</option>
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <div className="row" style={{ gap: 'var(--s-1)', alignItems: 'center' }} title="Период по дате создания">
                <input type="date" className="input mono" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} style={{ width: 140 }} />
                <span className="muted" style={{ fontSize: 11 }}>—</span>
                <input type="date" className="input mono" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} style={{ width: 140 }} />
                {(createdFrom || createdTo) && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setCreatedFrom(''); setCreatedTo(''); }}>×</button>
                )}
              </div>
              {data && <span className="mono muted">всего: <span className="tnum">{data.total}</span></span>}
            </>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
            <Plus size={14} strokeWidth={2} /> Новая заявка
          </button>
        </div>
      </header>

      {error && <div className="callout callout--danger"><span>{error}</span></div>}

      {!data ? (
        <div className="muted">Загрузка…</div>
      ) : data.items.length === 0 ? (
        <div className="card col" style={{ padding: 'var(--s-7)', alignItems: 'center', gap: 'var(--s-3)', color: 'var(--ais-bone-3)' }}>
          <KeyRound size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>Заявок пока нет</span>
        </div>
      ) : (
        <>
          <div className="card card--bleed">
            <table className="table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Группа / должность</th>
                  <th>Общежитие</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/passes/${p.id}`} className="link">{p.fullName}</Link>
                    </td>
                    <td className="mono">{p.groupOrPosition}</td>
                    <td>{HOSTEL_LABELS[p.hostel]}</td>
                    <td><span className={`badge ${STATUS_VARIANT[p.status]}`}>{STATUS_LABELS[p.status]}</span></td>
                    <td className="muted" style={{ fontSize: 'var(--fs-13)' }}>{p.statusComment ?? '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                        <Link href={`/passes/${p.id}`} className="btn btn--ghost btn--sm">
                          <Eye size={12} strokeWidth={1.75} /> Открыть
                        </Link>
                        {p.ticketKey && (
                          <button onClick={() => viewTicket(p.id)} className="btn btn--ghost btn--sm">
                            Квитанция
                          </button>
                        )}
                        {p.status !== 'APPROVED' && (
                          <button onClick={() => decide(p.id, 'APPROVE')} disabled={busy === p.id} className="btn btn--primary btn--sm">
                            Выдать
                          </button>
                        )}
                        {p.status !== 'REJECTED' && (
                          <button onClick={() => decide(p.id, 'REJECT')} disabled={busy === p.id} className="btn btn--danger btn--sm">
                            Отклонить
                          </button>
                        )}
                        {p.status !== 'PENDING' && (
                          <button onClick={() => decide(p.id, 'RESET')} disabled={busy === p.id} className="btn btn--ghost btn--sm">
                            В работу
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-3)', alignItems: 'center' }}>
              <button className="btn btn--ghost btn--sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Назад
              </button>
              <span className="mono muted">{page + 1} / {totalPages}</span>
              <button className="btn btn--ghost btn--sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Далее →
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <NewPassModal
          initialStudent={prefillStudent}
          studentMode={studentMode}
          onClose={() => { setShowForm(false); setPrefillStudent(null); }}
          onCreated={() => { setShowForm(false); setPrefillStudent(null); void load(); }}
        />
      )}
    </div>
  );
}

type PassSubject = 'student' | 'other';

function NewPassModal({
  onClose, onCreated, initialStudent, studentMode,
}: {
  onClose: () => void;
  onCreated: () => void;
  initialStudent?: PickedStudent | null;
  studentMode: boolean;
}) {
  // Заявку могут оформлять как на студента (тогда тянем из Сетевого ПОО),
  // так и на сотрудника / визитёра — тогда поля свободные.
  const [subject, setSubject] = useState<PassSubject>('student');
  const [student, setStudent] = useState<PickedStudent | null>(initialStudent ?? null);
  const [fullName, setFullName] = useState(
    initialStudent
      ? `${initialStudent.lastName} ${initialStudent.firstName} ${initialStudent.middleName ?? ''}`.trim()
      : '',
  );
  const [groupOrPosition, setGroupOrPosition] = useState(initialStudent?.groupName ?? '');
  const [hostel, setHostel] = useState<Hostel>('NONE');
  const [ticket, setTicket] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Студент оформляет пропуск себе — подтягиваем ФИО и группу из своей учётки.
  async function fillMyData() {
    setError(null);
    try {
      const me = await apiFetch<{
        studentExternalId: number | null;
        firstName: string; lastName: string; middleName: string | null;
      }>('/api/users/me');
      setFullName(`${me.lastName} ${me.firstName} ${me.middleName ?? ''}`.trim());
      if (me.studentExternalId) {
        const d = await apiFetch<{ studentGroup?: { name?: string } }>(
          `/api/poozabeduapi/students/${me.studentExternalId}`,
        );
        if (d.studentGroup?.name) setGroupOrPosition(d.studentGroup.name);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось заполнить ваши данные');
    }
  }

  function onPickStudent(s: PickedStudent | null) {
    setStudent(s);
    if (s) {
      setFullName(`${s.lastName} ${s.firstName} ${s.middleName ?? ''}`.trim());
      setGroupOrPosition(s.groupName ?? '');
    }
  }

  function switchSubject(next: PassSubject) {
    setSubject(next);
    if (next === 'other') {
      // переход на «иное лицо» — сбрасываем студенческий контекст
      setStudent(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string }>('/api/passes', {
        method: 'POST',
        body: { fullName: fullName.trim(), groupOrPosition: groupOrPosition.trim(), hostel },
      });
      // Если приложили квитанцию — заливаем напрямую в MinIO по presigned URL.
      if (ticket) {
        const init = await apiFetch<{ uploadUrl: string }>(`/api/passes/${created.id}/ticket-upload`, {
          method: 'POST',
          body: {
            originalName: ticket.name,
            contentType: ticket.type || 'application/octet-stream',
            sizeBytes: ticket.size,
          },
        });
        const put = await fetch(init.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ticket.type || 'application/octet-stream' },
          body: ticket,
        });
        if (!put.ok) throw new Error('Не удалось загрузить квитанцию в хранилище');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Не удалось создать заявку');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-4)',
    }}>
      <form className="card col" onClick={(e) => e.stopPropagation()} onSubmit={submit}
            style={{ maxWidth: 480, width: '100%', padding: 'var(--s-5)', gap: 'var(--s-4)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Новая заявка</h2>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="callout callout--danger"><span>{error}</span></div>}

        {studentMode ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={fillMyData}
                  style={{ alignSelf: 'flex-start' }}>
            Заполнить моими данными
          </button>
        ) : (
          <>
            {/* Тип лица — студент (из Сетевого ПОО) или иное (свободные поля) */}
            <div className="row" style={{ gap: 0, border: '1px solid var(--ais-line)', borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => switchSubject('student')}
                className={subject === 'student' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
                style={{ flex: 1 }}
              >
                Студент
              </button>
              <button
                type="button"
                onClick={() => switchSubject('other')}
                className={subject === 'other' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
                style={{ flex: 1 }}
              >
                Сотрудник / иное лицо
              </button>
            </div>

            {subject === 'student' && (
              <div className="col" style={{ gap: 'var(--s-1)' }}>
                <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Студент (из Сетевого ПОО)</span>
                <StudentPicker value={student} onChange={onPickStudent} required />
              </div>
            )}
          </>
        )}

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            ФИО {!studentMode && subject === 'student' && <span style={{ opacity: 0.6 }}>(подставляется из выбора)</span>}
          </span>
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            {studentMode || subject === 'student' ? 'Группа' : 'Должность / организация'}
          </span>
          <input className="input" required value={groupOrPosition} onChange={(e) => setGroupOrPosition(e.target.value)} />
        </label>
        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Общежитие</span>
          <select className="input" value={hostel} onChange={(e) => setHostel(e.target.value as Hostel)}>
            {(Object.keys(HOSTEL_LABELS) as Hostel[]).map((h) => (
              <option key={h} value={h}>{HOSTEL_LABELS[h]}</option>
            ))}
          </select>
        </label>
        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            <Upload size={11} strokeWidth={1.75} style={{ verticalAlign: 'middle' }} /> Квитанция (PDF/JPG/PNG/WebP, до 10 МБ)
          </span>
          <input
            className="input"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setTicket(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Простой выбор комментария: предлагаем выбрать из справочника + дописать. Используем `prompt`,
 * чтобы не плодить ещё одну модалку — для админского сценария достаточно.
 */
function pickComment(label: string, options: CommentOption[], optional = false): string | null {
  if (options.length === 0) {
    const v = window.prompt(label) ?? '';
    return v.trim() || (optional ? null : null);
  }
  const lines = options.map((o, i) => `${i + 1}. ${o.title} — ${o.text}`).join('\n');
  const choice = window.prompt(
    `${label}\n\nВыберите номер из справочника или введите свой текст:\n${lines}`,
    options.find((o) => o.isDefault)?.text ?? '',
  );
  if (choice === null) return null;
  const trimmed = choice.trim();
  if (!trimmed) return optional ? null : null;
  // если ввели только цифру — взяли вариант из списка
  const idx = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) - 1 : -1;
  if (idx >= 0 && idx < options.length) return options[idx].text;
  return trimmed;
}
