'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileText, Plus, X, Eye, Printer } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';
import { StudentPicker, type PickedStudent } from '@/components/student-picker';
import { useAuth } from '@/lib/auth-context';
import { isStudentOnly } from '@/lib/role-helpers';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type CertType = 'STUDY' | 'SCHOLARSHIP' | 'INCOME' | 'TAX' | 'MILITARY';

interface CertRow {
  id: string;
  displayNo: number;
  certType: CertType;
  fullName: string;
  groupName: string;
  targetOrg: string;
  email: string;
  phone: string;
  status: Status;
  statusComment: string | null;
  createdAt: string;
}

interface CertsPage {
  total: number;
  items: CertRow[];
}

interface CommentOption {
  id: string;
  title: string;
  text: string;
  isDefault: boolean;
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'В работе',
  APPROVED: 'Выполнена',
  REJECTED: 'Отклонена',
};
const STATUS_VARIANT: Record<Status, string> = {
  PENDING: 'badge--warn',
  APPROVED: 'badge--ok',
  REJECTED: 'badge--bad',
};
const TYPE_LABELS: Record<CertType, string> = {
  STUDY: 'Об обучении',
  SCHOLARSHIP: 'О стипендии',
  INCOME: 'О доходах',
  TAX: 'Налоговый вычет',
  MILITARY: 'В военкомат',
};

const PAGE_SIZE = 25;

export default function CertificatesPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA', 'STU']}>
      <CertificatesView />
    </Protected>
  );
}

function CertificatesView() {
  const { user } = useAuth();
  const studentMode = isStudentOnly(user);
  const [filter, setFilter] = useState<Status | ''>('');
  const [typeFilter, setTypeFilter] = useState<CertType | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<CertsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prefillStudent, setPrefillStudent] = useState<PickedStudent | null>(null);
  const [comments, setComments] = useState<CommentOption[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Если пришли с `?orderFor=<externalId>` (например, из досье — TEA оформляет
  // справку студенту своей группы) — подтягиваем карточку из зеркала и сразу
  // открываем модалку с предзаполнением.
  useEffect(() => {
    const orderFor = searchParams?.get('orderFor');
    if (!orderFor) return;
    const id = Number(orderFor);
    if (!Number.isFinite(id) || id <= 0) return;
    apiFetch<{
      id: number; firstName: string; lastName: string; middleName?: string;
      birthday?: string; studentGroup?: { id?: number; name?: string };
    }>(`/api/poozabeduapi/students/${id}`)
      .then((d) => {
        setPrefillStudent({
          externalId: d.id,
          lastName: d.lastName,
          firstName: d.firstName,
          middleName: d.middleName ?? null,
          birthDate: d.birthday ? d.birthday.slice(0, 10) : null,
          groupExternalId: d.studentGroup?.id ?? null,
          groupName: d.studentGroup?.name ?? null,
        });
        setShowForm(true);
        // Чистим query, чтобы при перезагрузке списка модалка не открывалась повторно.
        router.replace('/certificates');
      })
      .catch(() => { /* дальше работает обычная форма с пустым выбором */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await apiFetch<CertsPage>('/api/certificates', {
        query: {
          status: filter || undefined,
          certType: typeFilter || undefined,
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
  }, [filter, typeFilter, search, createdFrom, createdTo, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    apiFetch<CommentOption[]>('/api/comment-options').then(setComments).catch(() => setComments([]));
  }, []);
  useEffect(() => { setPage(0); }, [filter, typeFilter, search, createdFrom, createdTo]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  async function decide(id: string, decision: 'APPROVE' | 'REJECT' | 'RESET') {
    let body: Record<string, unknown> = { decision };
    if (decision === 'REJECT') {
      const reason = pickComment('Причина отклонения:', comments);
      if (!reason) return;
      body = { decision, comment: reason };
    } else if (decision === 'APPROVE') {
      const note = pickComment('Комментарий (необязательно):', comments, true);
      if (note) body = { decision, approveComment: note };
    }
    setBusy(id);
    try {
      await apiFetch(`/api/certificates/${id}/status`, { method: 'POST', body });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
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
            Справки
          </h1>
        </div>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {!studentMode && (
            <>
              <form onSubmit={applySearch} className="row" style={{ gap: 'var(--s-2)' }}>
                <input className="input" placeholder="Поиск по ФИО / группе / email"
                       value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ width: 220 }} />
                <button type="submit" className="btn btn--ghost btn--sm">Найти</button>
              </form>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CertType | '')} className="input" style={{ width: 'auto' }}>
                <option value="">Все типы</option>
                {(Object.keys(TYPE_LABELS) as CertType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <select value={filter} onChange={(e) => setFilter(e.target.value as Status | '')} className="input" style={{ width: 'auto' }}>
                <option value="">Все статусы</option>
                {(Object.keys(STATUS_LABELS) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
          <FileText size={36} strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--fs-14)' }}>Заявок нет</span>
        </div>
      ) : (
        <>
          <div className="card card--bleed">
            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  {!studentMode && <th>ФИО</th>}
                  <th>Группа</th>
                  <th>Тип</th>
                  <th>Куда</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                  <th>{studentMode ? '' : 'Действия'}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => {
                  const printHref = c.certType === 'MILITARY'
                    ? `/certificates/${c.id}/print-military`
                    : `/certificates/${c.id}/print`;
                  return (
                    <tr key={c.id}>
                      <td className="mono tnum">С-{c.displayNo}</td>
                      {!studentMode && <td><Link href={`/certificates/${c.id}`} className="link">{c.fullName}</Link></td>}
                      <td className="mono">{c.groupName}</td>
                      <td>{TYPE_LABELS[c.certType]}</td>
                      <td className="muted" style={{ fontSize: 'var(--fs-13)' }}>{c.targetOrg}</td>
                      <td><span className={`badge ${STATUS_VARIANT[c.status]}`}>{STATUS_LABELS[c.status]}</span></td>
                      <td className="muted" style={{ fontSize: 'var(--fs-13)' }}>{c.statusComment ?? '—'}</td>
                      <td>
                        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                          <Link href={`/certificates/${c.id}`} className="btn btn--ghost btn--sm">
                            <Eye size={12} strokeWidth={1.75} /> Карточка
                          </Link>
                          {!studentMode && c.status === 'APPROVED' && (
                            <Link href={printHref} target="_blank" className="btn btn--ghost btn--sm">
                              <Printer size={12} strokeWidth={1.75} /> Печать
                            </Link>
                          )}
                          {!studentMode && c.status !== 'APPROVED' && (
                            <button onClick={() => decide(c.id, 'APPROVE')} disabled={busy === c.id} className="btn btn--primary btn--sm">Выдать</button>
                          )}
                          {!studentMode && c.status !== 'REJECTED' && (
                            <button onClick={() => decide(c.id, 'REJECT')} disabled={busy === c.id} className="btn btn--danger btn--sm">Отклонить</button>
                          )}
                          {!studentMode && c.status !== 'PENDING' && (
                            <button onClick={() => decide(c.id, 'RESET')} disabled={busy === c.id} className="btn btn--ghost btn--sm">В работу</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        <NewCertificateModal
          initialStudent={prefillStudent}
          studentMode={studentMode}
          onClose={() => { setShowForm(false); setPrefillStudent(null); }}
          onCreated={() => { setShowForm(false); setPrefillStudent(null); void load(); }}
        />
      )}
    </div>
  );
}

function NewCertificateModal({
  onClose, onCreated, initialStudent, studentMode,
}: {
  onClose: () => void;
  onCreated: () => void;
  initialStudent?: PickedStudent | null;
  studentMode: boolean;
}) {
  const [certType, setCertType] = useState<CertType>('STUDY');
  const [student, setStudent] = useState<PickedStudent | null>(initialStudent ?? null);
  const [fullName, setFullName] = useState(
    initialStudent
      ? `${initialStudent.lastName} ${initialStudent.firstName} ${initialStudent.middleName ?? ''}`.trim()
      : '',
  );
  const [birthDate, setBirthDate] = useState(initialStudent?.birthDate ?? '');
  const [groupName, setGroupName] = useState(initialStudent?.groupName ?? '');
  const [targetOrg, setTargetOrg] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillMyData = useCallback(async () => {
    setError(null);
    try {
      const me = await apiFetch<{
        studentExternalId: number | null;
        firstName: string; lastName: string; middleName: string | null;
      }>('/api/users/me');
      setFullName(`${me.lastName} ${me.firstName} ${me.middleName ?? ''}`.trim());
      if (me.studentExternalId) {
        const d = await apiFetch<{
          phone?: string; email?: string; birthday?: string;
          studentGroup?: { id?: number; name?: string };
        }>(`/api/poozabeduapi/students/${me.studentExternalId}`);
        if (d.birthday) setBirthDate(d.birthday.slice(0, 10));
        if (d.studentGroup?.name) setGroupName(d.studentGroup.name);
        if (d.phone) setPhone(d.phone);
        if (d.email) setEmail(d.email);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось заполнить ваши данные');
    }
  }, []);

  // Студент → автозаполнение при открытии формы.
  useEffect(() => {
    if (studentMode && !fullName) void fillMyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentMode]);

  // Если оператор подтянул карточку из Сетевого, по запросу подгрузим телефон —
  // у нас в зеркале телефонов нет, они только в детальном эндпоинте.
  async function fillFromUpstream() {
    if (!student) return;
    setError(null);
    try {
      const detail = await apiFetch<{ phone?: string; email?: string; birthday?: string }>(
        `/api/poozabeduapi/students/${student.externalId}`,
      );
      if (detail.phone && !phone) setPhone(detail.phone);
      if (detail.email && !email) setEmail(detail.email);
      if (detail.birthday && !birthDate) setBirthDate(detail.birthday.slice(0, 10));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось получить детали из Сетевого ПОО');
    }
  }

  function onPickStudent(s: PickedStudent | null) {
    setStudent(s);
    if (s) {
      setFullName(`${s.lastName} ${s.firstName} ${s.middleName ?? ''}`.trim());
      setGroupName(s.groupName ?? '');
      setBirthDate(s.birthDate ?? '');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/certificates', {
        method: 'POST',
        body: {
          certType, fullName: fullName.trim(), birthDate,
          groupName: groupName.trim(), targetOrg: targetOrg.trim(),
          phone: phone.trim(), email: email.trim(),
          comment: comment.trim() || undefined,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать заявку');
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
            style={{ maxWidth: 560, width: '100%', padding: 'var(--s-5)', gap: 'var(--s-3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>Новая заявка на справку</h2>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose}><X size={16} /></button>
        </div>

        {error && <div className="callout callout--danger"><span>{error}</span></div>}

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Тип справки</span>
          <select className="input" value={certType} onChange={(e) => setCertType(e.target.value as CertType)}>
            {(Object.keys(TYPE_LABELS) as CertType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </label>

        {studentMode ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={fillMyData}
                  style={{ alignSelf: 'flex-start' }}>
            Себе
          </button>
        ) : (
          <div className="col" style={{ gap: 'var(--s-1)' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Студент (из Сетевого ПОО)</span>
            <StudentPicker value={student} onChange={onPickStudent} />
            {student && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={fillFromUpstream}
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                Подтянуть телефон/email из Сетевого ПОО
              </button>
            )}
          </div>
        )}

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>ФИО (можно скорректировать для печати)</span>
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>

        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <label className="col" style={{ gap: 'var(--s-1)', flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Дата рождения</span>
            <input type="date" className="input" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 'var(--s-1)', flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Группа</span>
            <input className="input mono" required value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </label>
        </div>

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Куда нужна справка</span>
          <input className="input" required value={targetOrg} onChange={(e) => setTargetOrg(e.target.value)} placeholder="Военкомат, СФР, налоговая…" />
        </label>

        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <label className="col" style={{ gap: 'var(--s-1)', flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Телефон</span>
            <input className="input mono" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="col" style={{ gap: 'var(--s-1)', flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Email</span>
            <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>

        <label className="col" style={{ gap: 'var(--s-1)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Примечание</span>
          <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
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
  const idx = /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) - 1 : -1;
  if (idx >= 0 && idx < options.length) return options[idx].text;
  return trimmed;
}
