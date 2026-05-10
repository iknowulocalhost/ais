'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, BookOpen, KeyRound, Copy, Check, UserPlus, FileText } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

/**
 * Досье конкретного студента — полная карточка из Сетевого ПОО.
 *
 * Live-прокси: каждое открытие страницы ходит в upstream и сразу забывает.
 * В нашу БД ничего не сохраняется — действует принцип минимизации (152-ФЗ),
 * а оператор всегда видит самые свежие данные.
 */

interface ParentInfo {
  id: number;
  userProfileId?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  relationshipType?: string;
  phone?: string;
  address?: string;
  birthday?: string;
  credentials?: { login?: string };
}

interface DecreeInfo {
  id: number;
  type?: string;
  date?: string;
  effectiveDate?: string;
  number?: string;
  studentGroup?: { id?: number; name?: string };
}

interface StudentDetail {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  birthday?: string;
  studentGroup?: { id?: number; name?: string };
  credentials?: { login?: string };
  userProfileId?: number;
  educationBasis?: string;
  educationLevel?: string;
  formOfTraining?: string;
  graduationDate?: string;
  gradePointAverage?: number;
  needInHostel?: string;
  isAdaptedProgram?: boolean;
  isLogtermTreatment?: boolean;
  isEsiaBound?: boolean;
  isIndigenousMinority?: boolean;
  birthplace?: string;
  registration?: string;
  address?: string;
  countryId?: number;
  email?: string;
  phone?: string;
  snils?: string;
  note?: string;
  passport?: {
    documentType?: string;
    series?: string;
    number?: string;
    issuanceDate?: string;
    issued?: string;
    subdivisionCode?: string;
  };
  parents?: ParentInfo[];
  decrees?: DecreeInfo[];
  documents?: unknown[];
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  Mother: 'Мать',
  Father: 'Отец',
  Guardian: 'Опекун',
  Other: 'Иное',
};

const HOSTEL_LABELS: Record<string, string> = {
  NotNeeded: 'Не требуется',
  Needed: 'Требуется',
  Provided: 'Предоставлено',
};

const FORM_LABELS: Record<string, string> = {
  InEducationOrganization: 'В образовательном учреждении',
  Family: 'Семейное обучение',
  SelfEducation: 'Самообразование',
  External: 'Экстернат',
};

const EDU_BASIS_LABELS: Record<string, string> = {
  FederalBudget: 'Федеральный бюджет',
  RegionalBudget: 'Региональный бюджет',
  NaturalPerson: 'Договор с физ. лицом',
  LegalPerson: 'Договор с юр. лицом',
};

const EDU_LEVEL_LABELS: Record<string, string> = {
  Basic: 'Основное общее',
  Secondary: 'Среднее общее',
};

export default function DossierDetailPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM', 'TEA']}>
      <DossierDetail />
    </Protected>
  );
}

function DossierDetail() {
  const params = useParams<{ externalId: string }>();
  const router = useRouter();
  const externalId = params?.externalId ? Number(params.externalId) : null;
  const [s, setS] = useState<StudentDetail | null>(null);
  const [collegeGpa, setCollegeGpa] = useState<{ gpa: number | null; sampleSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!externalId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<StudentDetail>(`/api/poozabeduapi/students/${externalId}`);
      setS(data);
      // Колледжевский GPA — отдельным запросом, ленивo. Если ошибка или нет
      // данных, в шапке покажется «—» (например, у первокурсника в сентябре).
      apiFetch<{ gpa: number | null; sampleSize: number }>(
        `/api/poozabeduapi/students/${externalId}/college-gpa`,
      )
        .then((g) => setCollegeGpa(g))
        .catch(() => setCollegeGpa({ gpa: null, sampleSize: 0 }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : explainError(e).hint);
      setS(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, [externalId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!s) return <div className="muted">Загрузка карточки…</div>;

  const fullName = `${s.lastName} ${s.firstName} ${s.middleName ?? ''}`.trim();

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 1000 }}>
      <button onClick={() => router.back()} className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> Назад
      </button>

      <header className="card" style={{ padding: 'var(--s-5)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--s-4)', alignItems: 'center' }}>
        {/* Фото-плейсхолдер. Когда подъедут реальные фото из upstream/MinIO,
            заменим на <img src=…>. Пока — крупные инициалы на бумажной плашке. */}
        <div
          className="avatar-block"
          aria-hidden
          style={{
            width: 96, height: 124, borderRadius: 6,
            background: 'var(--ais-paper-2)',
            border: '1px solid var(--ais-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--ff-mono, monospace)',
            fontSize: 32, fontWeight: 600,
            color: 'var(--ais-bone-3)',
            flexShrink: 0,
          }}
        >
          {(s.lastName?.[0] ?? '').toUpperCase()}{(s.firstName?.[0] ?? '').toUpperCase() || '·'}
        </div>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            Личное дело студента
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(22px, 2.4vw, 32px)', margin: 0, lineHeight: 1.2 }}>
            {fullName}
          </h1>
          <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap', alignItems: 'baseline' }}>
            {s.studentGroup?.name && (
              <span className="badge badge--ok" style={{ fontSize: 'var(--fs-12)' }}>
                {s.studentGroup.name}
              </span>
            )}
            {/* Колледжевский средний балл — реальная успеваемость в техникуме,
                считается на лету из аттестационной ведомости текущего и
                предыдущего семестров. Школьный балл (аттестат при поступлении)
                ниже, в разделе «Обучение». */}
            <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>
              ср. балл в техникуме:{' '}
              {collegeGpa === null ? (
                <span className="mono muted">…</span>
              ) : collegeGpa.gpa === null ? (
                <span className="mono muted" title="Аттестационных оценок ещё нет">—</span>
              ) : (
                <span className="mono tnum" style={{ fontWeight: 600 }} title={`по ${collegeGpa.sampleSize} аттестациям`}>
                  {collegeGpa.gpa.toFixed(2)}
                </span>
              )}
            </span>
            <span className="mono muted" style={{ fontSize: 11 }}>
              Личное дело №{s.id}
            </span>
          </div>
        </div>
        <div className="col" style={{ gap: 'var(--s-2)', alignItems: 'flex-end' }}>
          <button onClick={() => void load()} className="btn btn--ghost btn--sm" disabled={busy}>
            <RefreshCw size={14} strokeWidth={1.75} className={busy ? 'spin' : ''} /> Обновить
          </button>
          {s.note && (
            <span className="muted" style={{ fontSize: 'var(--fs-12)', textAlign: 'right', maxWidth: 320 }}>
              {s.note}
            </span>
          )}
        </div>
      </header>

      {/* ────────── Основное ────────── */}
      <Section title="Основные сведения">
        <Field label="Пол" value={s.gender === 'Male' ? 'Мужской' : s.gender === 'Female' ? 'Женский' : '—'} />
        <Field label="Дата рождения" value={s.birthday ? fmtDateRu(s.birthday) : '—'} />
        <Field label="Место рождения" value={s.birthplace ?? '—'} full />
        <Field label="Гражданство" value={s.countryId === 643 ? 'Россия' : (s.countryId ? `country ${s.countryId}` : '—')} />
        <Field label="Логин в электронном журнале" value={s.credentials?.login ?? '—'} mono />
        <Field label="Привязка к Госуслугам" value={s.isEsiaBound ? 'Привязан' : 'Не привязан'} />
      </Section>

      {/* ────────── Контакты ────────── */}
      <Section title="Контакты и адреса">
        <Field label="Телефон" value={s.phone ?? '—'} mono />
        <Field label="E-mail" value={s.email ?? '—'} />
        <Field label="Регистрация" value={s.registration || '—'} full />
        <Field label="Фактический адрес" value={s.address || '—'} full />
      </Section>

      {/* ────────── Документы ────────── */}
      <Section title="Документы">
        <Field label="СНИЛС" value={fmtSnils(s.snils)} mono />
        {s.passport && (
          <>
            <Field label="Паспорт серия / номер" value={`${s.passport.series ?? ''} ${s.passport.number ?? ''}`.trim() || '—'} mono />
            <Field label="Дата выдачи" value={s.passport.issuanceDate ? fmtDateRu(s.passport.issuanceDate) : '—'} />
            <Field label="Кем выдан" value={s.passport.issued ?? '—'} full />
            <Field label="Код подразделения" value={s.passport.subdivisionCode ?? '—'} mono />
          </>
        )}
      </Section>

      {/* ────────── Учёба ────────── */}
      <Section title="Обучение">
        <Field label="Основа обучения" value={s.educationBasis ? (EDU_BASIS_LABELS[s.educationBasis] ?? s.educationBasis) : '—'} />
        <Field
          label="Средний балл аттестата"
          value={typeof s.gradePointAverage === 'number' ? s.gradePointAverage.toFixed(2) : '—'}
          mono
          hint="Импортируется из Сетевого ПОО при зачислении — балл школьного аттестата"
        />
        <Field label="Уровень предыдущего образования" value={s.educationLevel ? (EDU_LEVEL_LABELS[s.educationLevel] ?? s.educationLevel) : '—'} />
        <Field label="Форма обучения" value={s.formOfTraining ? (FORM_LABELS[s.formOfTraining] ?? s.formOfTraining) : '—'} />
        <Field label="Дата окончания" value={s.graduationDate ? fmtDateRu(s.graduationDate) : '—'} />
        <Field label="Общежитие" value={s.needInHostel ? (HOSTEL_LABELS[s.needInHostel] ?? s.needInHostel) : '—'} />
        <Field label="Адаптированная программа" value={s.isAdaptedProgram ? 'Да' : 'Нет'} />
        <Field label="Длительное лечение" value={s.isLogtermTreatment ? 'Да' : 'Нет'} />
        <Field label="КМНС" value={s.isIndigenousMinority ? 'Да' : 'Нет'} hint="Коренной малочисленный народ Севера" />
      </Section>

      {/* ────────── Аккаунт студента ────────── */}
      <Section title="Аккаунт АИС" fullCols>
        <StudentAccountCard externalId={s.id} />
      </Section>

      {/* ────────── Приказы ────────── */}
      {s.decrees && s.decrees.length > 0 && (
        <Section title={`Приказы (${s.decrees.length})`} fullCols>
          <div className="card card--bleed">
            <table className="table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Действует с</th>
                  <th>Группа</th>
                </tr>
              </thead>
              <tbody>
                {s.decrees.map((d) => (
                  <tr key={d.id}>
                    <td>{decreeTypeLabel(d.type)}</td>
                    <td className="mono">{d.number ?? '—'}</td>
                    <td className="mono muted">{d.date ? fmtDateRu(d.date) : '—'}</td>
                    <td className="mono muted">{d.effectiveDate ? fmtDateRu(d.effectiveDate) : '—'}</td>
                    <td className="mono">{d.studentGroup?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ────────── Родители ────────── */}
      {s.parents && s.parents.length > 0 && (
        <Section title={`Родители / законные представители (${s.parents.length})`} fullCols>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--s-3)' }}>
            {s.parents.map((p) => (
              <div key={p.id} className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-2)', background: 'var(--ais-paper-2)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--fs-13)' }}>
                    {p.lastName ?? ''} {p.firstName ?? ''} {p.middleName ?? ''}
                  </span>
                  <span className="badge" style={{ fontSize: 11 }}>
                    {p.relationshipType ? (RELATIONSHIP_LABELS[p.relationshipType] ?? p.relationshipType) : '—'}
                  </span>
                </div>
                <div className="col" style={{ gap: 4 }}>
                  {p.phone && (
                    <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                      телефон: <span className="mono">{p.phone}</span>
                    </span>
                  )}
                  {p.address && (
                    <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                      адрес: {p.address}
                    </span>
                  )}
                  {p.credentials?.login && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Логин: <span className="mono">{p.credentials.login}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ────────── Быстрые действия ────────── */}
      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        <Link href={`/certificates?orderFor=${s.id}`} className="btn btn--primary btn--sm">
          <FileText size={14} strokeWidth={1.75} /> Заказать справку
        </Link>
        <Link href={`/passes?orderFor=${s.id}`} className="btn btn--primary btn--sm">
          <KeyRound size={14} strokeWidth={1.75} /> Заказать пропуск
        </Link>
        {s.studentGroup?.id && (
          <Link href="/journal" className="btn btn--ghost btn--sm">
            <BookOpen size={14} strokeWidth={1.75} /> Журнал группы {s.studentGroup.name}
          </Link>
        )}
      </div>

      <style jsx>{`
        :global(.spin) { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ────────── presentational ──────────

function Section({
  title, fullCols = false, children,
}: {
  title: string;
  fullCols?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="col" style={{ gap: 'var(--s-3)' }}>
      <h2 className="display" style={{ fontSize: 'var(--fs-22)', margin: 0 }}>{title}</h2>
      {fullCols ? (
        <div>{children}</div>
      ) : (
        <div className="card" style={{
          padding: 'var(--s-4)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--s-4)',
        }}>
          {children}
        </div>
      )}
    </section>
  );
}

function Field({
  label, value, mono, hint, full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
  full?: boolean;
}) {
  return (
    <div className="col" style={{ gap: 4, gridColumn: full ? '1 / -1' : undefined }}>
      <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ fontSize: 'var(--fs-14)' }}>{value}</span>
      {hint && <span className="muted" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
  );
}

// ────────── helpers ──────────

// ────────── аккаунт студента ──────────

interface StudentAccount {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface PasswordEvent {
  ts: string;
  actorId: string | null;
  actorName: string | null;
  ipAddress: string | null;
  selfReset: boolean;
}

interface PasswordHistory {
  lastLoginAt: string | null;
  events: PasswordEvent[];
}

function StudentAccountCard({ externalId }: { externalId: number }) {
  const [acc, setAcc] = useState<StudentAccount | null>(null);
  const [history, setHistory] = useState<PasswordHistory | null>(null);
  const [busy, setBusy] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadAccount() {
    setBusy(true);
    setErrorText(null);
    try {
      const a = await apiFetch<StudentAccount>(`/api/users/students/${externalId}/account`);
      setAcc(a);
      // Историю смен пароля грузим только если аккаунт уже есть.
      const h = await apiFetch<PasswordHistory>(`/api/users/${a.id}/password-history`).catch(() => null);
      setHistory(h);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setAcc(null);
        setHistory(null);
      } else {
        setErrorText(e instanceof ApiError ? e.message : explainError(e).hint);
      }
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void loadAccount(); }, [externalId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureAccount() {
    setBusy(true);
    setErrorText(null);
    try {
      const r = await apiFetch<{ created: boolean; userId: string; email: string; password: string | null }>(
        `/api/users/students/${externalId}/account`,
        { method: 'POST' },
      );
      if (r.password) setIssued({ email: r.email, password: r.password });
      await loadAccount();
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!acc) return;
    if (!window.confirm('Сбросить текущий пароль и сгенерировать новый? Старый пароль перестанет работать сразу.')) return;
    setBusy(true);
    setErrorText(null);
    try {
      const r = await apiFetch<{ password: string; email: string }>(
        `/api/users/${acc.id}/reset-password`,
        { method: 'POST' },
      );
      setIssued({ email: r.email, password: r.password });
      // Подтягиваем журнал — там уже появилась только что сделанная запись.
      const h = await apiFetch<PasswordHistory>(`/api/users/${acc.id}/password-history`).catch(() => null);
      setHistory(h);
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.message : explainError(e).hint);
    } finally {
      setBusy(false);
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

  return (
    <div className="card col" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
      {errorText && <div className="callout callout--danger"><span>{errorText}</span></div>}

      {issued && (
        <div className="callout callout--ok col" style={{ gap: 'var(--s-2)' }}>
          <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>
            Пароль сгенерирован. Сохраните или передайте студенту — он показывается один раз.
          </span>
          <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Логин:</span>
            <span className="mono" style={{ fontSize: 'var(--fs-14)' }}>{issued.email}</span>
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Пароль:</span>
            <span className="mono" style={{ fontSize: 'var(--fs-15)', fontWeight: 600, letterSpacing: '0.05em' }}>
              {issued.password}
            </span>
            <button onClick={copyPassword} className="btn btn--ghost btn--sm" type="button">
              {copied ? <Check size={12} strokeWidth={1.75} /> : <Copy size={12} strokeWidth={1.75} />}
              {copied ? 'Скопировано' : 'Скопировать пароль'}
            </button>
          </div>
        </div>
      )}

      {busy && !acc && !issued ? (
        <div className="muted">Проверяем аккаунт…</div>
      ) : acc ? (
        <>
          <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Логин для входа в АИС</span>
              <span className="mono" style={{ fontSize: 'var(--fs-14)' }}>{acc.email}</span>
            </div>
            <div className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Последний вход</span>
              <span className="mono" style={{ fontSize: 'var(--fs-14)' }}>
                {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString('ru-RU') : 'не входил ни разу'}
              </span>
            </div>
            <div className="col" style={{ gap: 4 }}>
              <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>Статус</span>
              <span className={`badge ${acc.isActive ? 'badge--ok' : 'badge--bad'}`} style={{ fontSize: 11 }}>
                {acc.isActive ? 'активен' : 'отключён'}
              </span>
            </div>
            <button
              onClick={resetPassword}
              disabled={busy}
              className="btn btn--ghost btn--sm"
              type="button"
              style={{ marginLeft: 'auto' }}
            >
              <KeyRound size={14} strokeWidth={1.75} /> Сбросить пароль
            </button>
          </div>

          {history && history.events.length > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary className="muted" style={{ fontSize: 'var(--fs-12)', cursor: 'pointer' }}>
                Журнал смен пароля ({history.events.length})
              </summary>
              <table className="table" style={{ marginTop: 'var(--s-2)', fontSize: 'var(--fs-12)' }}>
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Кто сбросил</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {history.events.map((e, i) => (
                    <tr key={i}>
                      <td className="mono">{new Date(e.ts).toLocaleString('ru-RU')}</td>
                      <td>
                        {e.selfReset
                          ? <span className="muted">сам студент</span>
                          : (e.actorName ?? <span className="muted">—</span>)}
                      </td>
                      <td className="mono muted">{e.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      ) : (
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-13)' }}>
            Аккаунт студента в АИС ещё не создан.
          </span>
          <button onClick={ensureAccount} disabled={busy} className="btn btn--primary btn--sm" type="button" style={{ marginLeft: 'auto' }}>
            <UserPlus size={14} strokeWidth={1.75} /> Создать аккаунт и пароль
          </button>
        </div>
      )}
    </div>
  );
}

function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function fmtSnils(raw: string | undefined): string {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11) return raw; // как пришло
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)} ${d.slice(9, 11)}`;
}

function decreeTypeLabel(t?: string): string {
  switch (t) {
    case 'Enroll': return 'Зачисление';
    case 'Expel': return 'Отчисление';
    case 'Transfer': return 'Перевод';
    case 'AcademicLeave': return 'Академический отпуск';
    case 'AcademicLeaveReturn': return 'Возврат из академического отпуска';
    case 'Restore': return 'Восстановление';
    case 'NextYear': return 'Перевод на следующий курс';
    case 'Graduation': return 'Выпуск';
    case 'Move': return 'Перевод между группами';
    case 'GroupChange': return 'Смена группы';
    case 'NameChange': return 'Смена ФИО';
    case 'Reward': return 'Поощрение';
    case 'Punishment': return 'Дисциплинарное взыскание';
    default: return t ?? '—';
  }
}
