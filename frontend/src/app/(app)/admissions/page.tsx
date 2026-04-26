'use client';

import { useState } from 'react';
import {
  Save,
  FileCheck,
  Camera,
  User,
  BookUser,
  Users,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  GraduationCap,
  ClipboardList,
  Wallet,
  UserCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { WebcamCapture } from '@/components/admissions/webcam-capture';
import { FormSection } from '@/components/admissions/section';

/**
 * /admissions — карточка абитуриента.
 * Все ПДн уходят на бэк зашифрованным JSON-payload (см. ApplicantCipherService).
 * Структура зеркалит CreateApplicantDto.
 */

/* ── domain types (зеркало бэк-DTO) ── */

type Gender = 'M' | 'F' | '';
type ParentKind = 'mother' | 'father' | 'guardian' | 'other';
type RepSource = 'student' | 'parent1' | 'parent2' | 'custom';
type EducationForm = 'full_time' | 'part_time' | 'distance' | '';
type SpoLevel = 'first' | 'second' | '';
type MilStatus = 'liable' | 'reserve' | 'not_liable' | '';

interface Passport {
  series: string;
  number: string;
  issuedBy: string;
  issuedDate: string;
  divisionCode: string;
  citizenship: string;
  registrationAddress: string;
}

interface Residence { phone: string; address: string }

interface Parent {
  kind: ParentKind;
  lastName: string;
  firstName: string;
  middleName: string;
  address: string;
  work: string;
  phone: string;
}

interface Representative {
  source: RepSource;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  address: string;
  passport: { series: string; number: string; issuedBy: string; issuedDate: string };
}

interface Education {
  institution: string;
  graduationYear: string;
  averageGrade: string;
  documentType: string;
  documentSeries: string;
  documentNumber: string;
  documentIssueDate: string;
  institutionType: string;
}

interface Questionnaire {
  medal: string;
  olympicChampion: string;
  workYears: string;
  workMonths: string;
  specialtyYears: string;
  specialtyMonths: string;
  foreignLanguages: string;
  spoLevel: SpoLevel;
}

interface Additional {
  receiptNumber: string;
  paidAmount: string;
  paidMonths: string;
  bank: string;
  accountNumber: string;
  needsDormitory: boolean;
  educationForm: EducationForm;
  benefits: string;
  specialty: string;
  note: string;
}

interface Military {
  status: MilStatus;
  category: string;
  rank: string;
  commissariat: string;
}

interface Draft {
  photo: string | null;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: Gender;
  inn: string;
  snils: string;
  registrationNumber: string;
  caseNumber: string;
  passport: Passport;
  residence: Residence;
  parents: Parent[];
  representative: Representative;
  education: Education[];
  questionnaire: Questionnaire;
  additional: Additional;
  military: Military;
}

const EMPTY_PASSPORT: Passport = {
  series: '', number: '', issuedBy: '', issuedDate: '',
  divisionCode: '', citizenship: 'РФ', registrationAddress: '',
};
const EMPTY_PARENT: Parent = {
  kind: 'mother', lastName: '', firstName: '', middleName: '',
  address: '', work: '', phone: '',
};
const EMPTY_REPRESENTATIVE: Representative = {
  source: 'parent1', lastName: '', firstName: '', middleName: '',
  birthDate: '', address: '',
  passport: { series: '', number: '', issuedBy: '', issuedDate: '' },
};
const EMPTY_EDUCATION: Education = {
  institution: '', graduationYear: '', averageGrade: '',
  documentType: '', documentSeries: '', documentNumber: '',
  documentIssueDate: '', institutionType: '',
};

const EMPTY_DRAFT: Draft = {
  photo: null,
  lastName: '', firstName: '', middleName: '',
  birthDate: '', birthPlace: '', gender: '',
  inn: '', snils: '', registrationNumber: '', caseNumber: '',
  passport: EMPTY_PASSPORT,
  residence: { phone: '', address: '' },
  parents: [],
  representative: EMPTY_REPRESENTATIVE,
  education: [],
  questionnaire: {
    medal: '', olympicChampion: '',
    workYears: '', workMonths: '', specialtyYears: '', specialtyMonths: '',
    foreignLanguages: '', spoLevel: '',
  },
  additional: {
    receiptNumber: '', paidAmount: '', paidMonths: '',
    bank: '', accountNumber: '',
    needsDormitory: false, educationForm: '',
    benefits: '', specialty: '', note: '',
  },
  military: { status: '', category: '', rank: '', commissariat: '' },
};

const DRAFT_KEY = 'ais.admission-draft';

const PARENT_KIND_LABELS: Record<ParentKind, string> = {
  mother: 'мать', father: 'отец', guardian: 'опекун', other: 'иное',
};
const EDU_FORM_LABELS: Record<Exclude<EducationForm, ''>, string> = {
  full_time: 'очная', part_time: 'очно-заочная', distance: 'заочная',
};

export default function AdmissionsPage() {
  const { hasRole } = useAuth();
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === 'undefined') return EMPTY_DRAFT;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? mergeDraft(EMPTY_DRAFT, JSON.parse(raw)) : EMPTY_DRAFT;
    } catch {
      return EMPTY_DRAFT;
    }
  });
  const [saved, setSaved] = useState<'idle' | 'ok' | 'submitted'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!hasRole(['ADM', 'COM'])) {
    return (
      <div className="col" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--s-7)', gap: 'var(--s-3)', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-22)' }}>Недостаточно прав</h1>
        <p className="muted" style={{ fontSize: 'var(--fs-14)' }}>
          Страница доступна сотрудникам приёмной комиссии и администрации.
        </p>
      </div>
    );
  }

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function patchPassport(sub: Partial<Passport>) {
    setDraft((d) => ({ ...d, passport: { ...d.passport, ...sub } }));
  }
  function patchResidence(sub: Partial<Residence>) {
    setDraft((d) => ({ ...d, residence: { ...d.residence, ...sub } }));
  }
  function patchRepresentative(sub: Partial<Representative>) {
    setDraft((d) => ({ ...d, representative: { ...d.representative, ...sub } }));
  }
  function patchRepPassport(sub: Partial<Representative['passport']>) {
    setDraft((d) => ({
      ...d,
      representative: { ...d.representative, passport: { ...d.representative.passport, ...sub } },
    }));
  }
  function patchQuestionnaire(sub: Partial<Questionnaire>) {
    setDraft((d) => ({ ...d, questionnaire: { ...d.questionnaire, ...sub } }));
  }
  function patchAdditional(sub: Partial<Additional>) {
    setDraft((d) => ({ ...d, additional: { ...d.additional, ...sub } }));
  }
  function patchMilitary(sub: Partial<Military>) {
    setDraft((d) => ({ ...d, military: { ...d.military, ...sub } }));
  }

  function addParent() {
    if (draft.parents.length >= 2) return;
    setDraft((d) => ({ ...d, parents: [...d.parents, { ...EMPTY_PARENT }] }));
  }
  function removeParent(i: number) {
    setDraft((d) => ({ ...d, parents: d.parents.filter((_, idx) => idx !== i) }));
  }
  function patchParent(i: number, sub: Partial<Parent>) {
    setDraft((d) => ({
      ...d,
      parents: d.parents.map((p, idx) => (idx === i ? { ...p, ...sub } : p)),
    }));
  }

  function addEducation() {
    setDraft((d) => ({ ...d, education: [...d.education, { ...EMPTY_EDUCATION }] }));
  }
  function removeEducation(i: number) {
    setDraft((d) => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));
  }
  function patchEducation(i: number, sub: Partial<Education>) {
    setDraft((d) => ({
      ...d,
      education: d.education.map((e, idx) => (idx === i ? { ...e, ...sub } : e)),
    }));
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSaved('ok');
    setTimeout(() => setSaved('idle'), 2000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/admissions', {
        method: 'POST',
        body: serializeForApi(draft),
      });
      localStorage.removeItem(DRAFT_KEY);
      setDraft(EMPTY_DRAFT);
      setSaved('submitted');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? typeof err.payload === 'object' && err.payload && 'message' in err.payload
            ? Array.isArray((err.payload as { message: unknown }).message)
              ? ((err.payload as { message: string[] }).message).join('; ')
              : String((err.payload as { message: unknown }).message)
            : err.message
          : 'Не удалось отправить карточку';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const requiredFilled = countRequiredFilled(draft);
  const requiredTotal = REQUIRED_FIELDS_TOTAL;
  const progress = Math.round((requiredFilled / requiredTotal) * 100);

  return (
    <form onSubmit={submit} className="col" style={{ gap: 'var(--s-5)', maxWidth: 1040 }}>
      {/* HERO */}
      <header
        className="card"
        style={{
          padding: 'var(--s-6)',
          borderColor: 'var(--ais-line-2)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 'var(--s-5)',
          alignItems: 'center',
        }}
      >
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            учебная часть · приёмная комиссия
          </div>
          <h1 className="display" style={{ fontSize: 'clamp(28px, 3vw, 40px)', margin: 0, lineHeight: 1.1 }}>
            Карточка абитуриента
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-14)', maxWidth: 620 }}>
            Внесите данные нового абитуриента. Черновик сохраняется локально, отправка передаст карточку приёмной комиссии в зашифрованном виде.
          </p>

          <div className="row" style={{ gap: 'var(--s-3)', marginTop: 'var(--s-3)' }}>
            <div style={{ flex: 1, maxWidth: 280, height: 6, borderRadius: 3, background: 'var(--ais-line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: progress === 100 ? 'var(--ais-forest)' : 'var(--ais-bone-3)',
                  transition: 'width var(--dur) var(--ease-out), background var(--dur) var(--ease-out)',
                }}
              />
            </div>
            <span className="mono tnum" style={{ fontSize: 'var(--fs-12)', color: 'var(--ais-bone-3)' }}>
              {requiredFilled} / {requiredTotal} обязательных
            </span>
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--s-2)', alignItems: 'flex-end', minWidth: 220 }}>
          {saved === 'ok' && (
            <span className="badge badge--ok"><CheckCircle2 size={12} strokeWidth={2} />черновик сохранён</span>
          )}
          {saved === 'submitted' && (
            <span className="badge badge--ok"><CheckCircle2 size={12} strokeWidth={2} />карточка отправлена</span>
          )}
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button type="button" onClick={saveDraft} className="btn btn--outline" disabled={submitting}>
              <Save size={14} strokeWidth={1.75} /> Черновик
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || requiredFilled < requiredTotal}>
              <FileCheck size={14} strokeWidth={2} /> {submitting ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', borderColor: 'var(--ais-ember)', color: 'var(--ais-ember)' }}>
          {error}
        </div>
      )}

      {/* 1. ФОТО */}
      <FormSection icon={Camera} title="Фотография" subtitle="Захват с веб-камеры — для личного дела." required>
        <WebcamCapture value={draft.photo} onChange={(p) => patch('photo', p)} />
      </FormSection>

      {/* 2. СТУДЕНТ */}
      <FormSection icon={User} title="Студент" subtitle="Базовые личные данные абитуриента." required>
        <div className="grid-form">
          <Field label="Фамилия" required>
            <input className="input" value={draft.lastName} onChange={(e) => patch('lastName', e.target.value)} required />
          </Field>
          <Field label="Имя" required>
            <input className="input" value={draft.firstName} onChange={(e) => patch('firstName', e.target.value)} required />
          </Field>
          <Field label="Отчество">
            <input className="input" value={draft.middleName} onChange={(e) => patch('middleName', e.target.value)} />
          </Field>

          <Field label="Дата рождения" required>
            <input type="date" className="input" value={draft.birthDate} onChange={(e) => patch('birthDate', e.target.value)} required />
          </Field>
          <Field label="Пол" required>
            <select className="select" value={draft.gender} onChange={(e) => patch('gender', e.target.value as Gender)} required>
              <option value="">—</option>
              <option value="M">мужской</option>
              <option value="F">женский</option>
            </select>
          </Field>
          <Field label="Регистрационный №">
            <input className="input mono" value={draft.registrationNumber} onChange={(e) => patch('registrationNumber', e.target.value)} />
          </Field>

          <Field label="Место рождения" required full>
            <input className="input" value={draft.birthPlace} onChange={(e) => patch('birthPlace', e.target.value)} required />
          </Field>

          <Field label="ИНН" hint="12 цифр (опционально)">
            <input
              className="input mono"
              maxLength={12}
              inputMode="numeric"
              value={draft.inn}
              onChange={(e) => patch('inn', e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label="СНИЛС" hint="000-000-000 00" required>
            <input
              className="input mono"
              placeholder="000-000-000 00"
              value={draft.snils}
              onChange={(e) => patch('snils', formatSnils(e.target.value))}
              required
            />
          </Field>
          <Field label="Дело №">
            <input className="input mono" value={draft.caseNumber} onChange={(e) => patch('caseNumber', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      {/* 3. ПАСПОРТ */}
      <FormSection icon={BookUser} title="Паспортные данные" required>
        <div className="grid-form">
          <Field label="Серия" required>
            <input
              className="input mono"
              maxLength={4}
              inputMode="numeric"
              value={draft.passport.series}
              onChange={(e) => patchPassport({ series: e.target.value.replace(/\D/g, '') })}
              required
            />
          </Field>
          <Field label="Номер" required>
            <input
              className="input mono"
              maxLength={6}
              inputMode="numeric"
              value={draft.passport.number}
              onChange={(e) => patchPassport({ number: e.target.value.replace(/\D/g, '') })}
              required
            />
          </Field>
          <Field label="Код подразделения" required>
            <input
              className="input mono"
              placeholder="000-000"
              maxLength={7}
              value={draft.passport.divisionCode}
              onChange={(e) => patchPassport({ divisionCode: formatDivisionCode(e.target.value) })}
              required
            />
          </Field>

          <Field label="Дата выдачи" required>
            <input type="date" className="input" value={draft.passport.issuedDate} onChange={(e) => patchPassport({ issuedDate: e.target.value })} required />
          </Field>
          <Field label="Гражданство">
            <input className="input" value={draft.passport.citizenship} onChange={(e) => patchPassport({ citizenship: e.target.value })} />
          </Field>
          <Field label="Кем выдан" required>
            <input className="input" value={draft.passport.issuedBy} onChange={(e) => patchPassport({ issuedBy: e.target.value })} required />
          </Field>

          <Field label="Прописка" full>
            <input className="input" value={draft.passport.registrationAddress} onChange={(e) => patchPassport({ registrationAddress: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      {/* 4. АДРЕС ПРОЖИВАНИЯ */}
      <FormSection icon={MapPin} title="Адрес проживания" subtitle="Если отличается от прописки." defaultOpen={false}>
        <div className="grid-form">
          <Field label="Телефон">
            <input className="input mono" placeholder="+7 (___) ___-__-__" value={draft.residence.phone} onChange={(e) => patchResidence({ phone: e.target.value })} />
          </Field>
          <Field label="Адрес проживания" full>
            <input className="input" value={draft.residence.address} onChange={(e) => patchResidence({ address: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      {/* 5. РОДИТЕЛИ */}
      <FormSection icon={Users} title="Родители" subtitle="Можно добавить до двух (мать/отец/опекун)." defaultOpen={false}>
        <div className="col" style={{ gap: 'var(--s-4)' }}>
          {draft.parents.length === 0 && (
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)' }}>Родители не указаны.</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--s-4)' }}>
            {draft.parents.map((p, i) => (
              <div key={i} className="card" style={{ padding: 'var(--s-4)', background: 'var(--ais-paper-2)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-3)' }}>
                  <div className="row" style={{ gap: 'var(--s-2)' }}>
                    <UserCircle size={16} strokeWidth={1.75} style={{ color: 'var(--ais-bone-3)' }} />
                    <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>Родитель {i + 1}</span>
                  </div>
                  <button type="button" onClick={() => removeParent(i)} className="btn btn--ghost btn--icon btn--sm" title="Удалить">
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>

                <div className="grid-form">
                  <Field label="Тип">
                    <select className="select" value={p.kind} onChange={(e) => patchParent(i, { kind: e.target.value as ParentKind })}>
                      {(Object.keys(PARENT_KIND_LABELS) as ParentKind[]).map((k) => (
                        <option key={k} value={k}>{PARENT_KIND_LABELS[k]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Телефон">
                    <input className="input mono" value={p.phone} onChange={(e) => patchParent(i, { phone: e.target.value })} />
                  </Field>
                  <Field label="Работа">
                    <input className="input" value={p.work} onChange={(e) => patchParent(i, { work: e.target.value })} />
                  </Field>

                  <Field label="Фамилия" full>
                    <input className="input" value={p.lastName} onChange={(e) => patchParent(i, { lastName: e.target.value })} />
                  </Field>
                  <Field label="Имя">
                    <input className="input" value={p.firstName} onChange={(e) => patchParent(i, { firstName: e.target.value })} />
                  </Field>
                  <Field label="Отчество">
                    <input className="input" value={p.middleName} onChange={(e) => patchParent(i, { middleName: e.target.value })} />
                  </Field>
                  <Field label="Адрес" full>
                    <input className="input" value={p.address} onChange={(e) => patchParent(i, { address: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          {draft.parents.length < 2 && (
            <button type="button" onClick={addParent} className="btn btn--outline" style={{ alignSelf: 'flex-start' }}>
              <Plus size={14} strokeWidth={2} /> Добавить родителя
            </button>
          )}
        </div>
      </FormSection>

      {/* 6. ПРЕДСТАВИТЕЛЬ */}
      <FormSection icon={UserCircle} title="Представитель" subtitle="Заполняется для несовершеннолетних или по необходимости." defaultOpen={false}>
        <div className="grid-form">
          <Field label="Источник данных" full>
            <select
              className="select"
              value={draft.representative.source}
              onChange={(e) => patchRepresentative({ source: e.target.value as RepSource })}
            >
              <option value="student">Сам студент</option>
              <option value="parent1">Родитель 1</option>
              <option value="parent2">Родитель 2</option>
              <option value="custom">Иное лицо</option>
            </select>
          </Field>

          <Field label="Фамилия">
            <input className="input" value={draft.representative.lastName} onChange={(e) => patchRepresentative({ lastName: e.target.value })} />
          </Field>
          <Field label="Имя">
            <input className="input" value={draft.representative.firstName} onChange={(e) => patchRepresentative({ firstName: e.target.value })} />
          </Field>
          <Field label="Отчество">
            <input className="input" value={draft.representative.middleName} onChange={(e) => patchRepresentative({ middleName: e.target.value })} />
          </Field>

          <Field label="Дата рождения">
            <input type="date" className="input" value={draft.representative.birthDate} onChange={(e) => patchRepresentative({ birthDate: e.target.value })} />
          </Field>
          <Field label="Адрес проживания" full>
            <input className="input" value={draft.representative.address} onChange={(e) => patchRepresentative({ address: e.target.value })} />
          </Field>

          <Field label="Серия паспорта">
            <input className="input mono" value={draft.representative.passport.series} onChange={(e) => patchRepPassport({ series: e.target.value })} />
          </Field>
          <Field label="Номер паспорта">
            <input className="input mono" value={draft.representative.passport.number} onChange={(e) => patchRepPassport({ number: e.target.value })} />
          </Field>
          <Field label="Дата выдачи">
            <input type="date" className="input" value={draft.representative.passport.issuedDate} onChange={(e) => patchRepPassport({ issuedDate: e.target.value })} />
          </Field>
          <Field label="Кем выдан" full>
            <input className="input" value={draft.representative.passport.issuedBy} onChange={(e) => patchRepPassport({ issuedBy: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      {/* 7. УЧЕБНЫЕ ЗАВЕДЕНИЯ */}
      <FormSection icon={GraduationCap} title="Оконченные учебные заведения" subtitle="Аттестаты и дипломы абитуриента." defaultOpen={false}>
        <div className="col" style={{ gap: 'var(--s-4)' }}>
          {draft.education.length === 0 && (
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-13)' }}>Нет записей.</p>
          )}

          {draft.education.map((edu, i) => (
            <div key={i} className="card" style={{ padding: 'var(--s-4)', background: 'var(--ais-paper-2)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-3)' }}>
                <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>Запись {i + 1}</span>
                <button type="button" onClick={() => removeEducation(i)} className="btn btn--ghost btn--icon btn--sm" title="Удалить">
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
              <div className="grid-form">
                <Field label="Учебное заведение" full>
                  <input className="input" value={edu.institution} onChange={(e) => patchEducation(i, { institution: e.target.value })} />
                </Field>
                <Field label="Тип заведения" full>
                  <input className="input" placeholder="общеобразовательное / СПО / ВО" value={edu.institutionType} onChange={(e) => patchEducation(i, { institutionType: e.target.value })} />
                </Field>

                <Field label="Год окончания">
                  <input className="input mono" inputMode="numeric" maxLength={4} value={edu.graduationYear} onChange={(e) => patchEducation(i, { graduationYear: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label="Средний балл" hint="например 4.25">
                  <input className="input mono" value={edu.averageGrade} onChange={(e) => patchEducation(i, { averageGrade: e.target.value })} />
                </Field>
                <Field label="Тип документа" hint="Аттестат 11кл, Диплом СПО…">
                  <input className="input" value={edu.documentType} onChange={(e) => patchEducation(i, { documentType: e.target.value })} />
                </Field>

                <Field label="Серия документа">
                  <input className="input mono" value={edu.documentSeries} onChange={(e) => patchEducation(i, { documentSeries: e.target.value })} />
                </Field>
                <Field label="Номер документа">
                  <input className="input mono" value={edu.documentNumber} onChange={(e) => patchEducation(i, { documentNumber: e.target.value })} />
                </Field>
                <Field label="Дата выдачи">
                  <input type="date" className="input" value={edu.documentIssueDate} onChange={(e) => patchEducation(i, { documentIssueDate: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}

          <button type="button" onClick={addEducation} className="btn btn--outline" style={{ alignSelf: 'flex-start' }}>
            <Plus size={14} strokeWidth={2} /> Добавить заведение
          </button>
        </div>
      </FormSection>

      {/* 8. АНКЕТА */}
      <FormSection icon={ClipboardList} title="Анкета" defaultOpen={false}>
        <div className="grid-form">
          <Field label="Медаль / диплом «с отличием»" full>
            <input className="input" value={draft.questionnaire.medal} onChange={(e) => patchQuestionnaire({ medal: e.target.value })} />
          </Field>
          <Field label="Победитель всероссийских олимпиад" full>
            <input className="input" value={draft.questionnaire.olympicChampion} onChange={(e) => patchQuestionnaire({ olympicChampion: e.target.value })} />
          </Field>

          <Field label="Трудовой стаж — лет">
            <input className="input mono" inputMode="numeric" value={draft.questionnaire.workYears} onChange={(e) => patchQuestionnaire({ workYears: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Трудовой стаж — мес.">
            <input className="input mono" inputMode="numeric" value={draft.questionnaire.workMonths} onChange={(e) => patchQuestionnaire({ workMonths: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Иностранные языки">
            <input className="input" value={draft.questionnaire.foreignLanguages} onChange={(e) => patchQuestionnaire({ foreignLanguages: e.target.value })} />
          </Field>

          <Field label="Стаж по специальности — лет">
            <input className="input mono" inputMode="numeric" value={draft.questionnaire.specialtyYears} onChange={(e) => patchQuestionnaire({ specialtyYears: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Стаж по специальности — мес.">
            <input className="input mono" inputMode="numeric" value={draft.questionnaire.specialtyMonths} onChange={(e) => patchQuestionnaire({ specialtyMonths: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="СПО получаю">
            <select className="select" value={draft.questionnaire.spoLevel} onChange={(e) => patchQuestionnaire({ spoLevel: e.target.value as SpoLevel })}>
              <option value="">—</option>
              <option value="first">впервые</option>
              <option value="second">повторно</option>
            </select>
          </Field>
        </div>
      </FormSection>

      {/* 9. ДОПОЛНИТЕЛЬНО */}
      <FormSection icon={Wallet} title="Дополнительно" defaultOpen={false}>
        <div className="grid-form">
          <Field label="Квитанция №">
            <input className="input mono" value={draft.additional.receiptNumber} onChange={(e) => patchAdditional({ receiptNumber: e.target.value })} />
          </Field>
          <Field label="Оплачено, ₽">
            <input className="input mono tnum" inputMode="decimal" value={draft.additional.paidAmount} onChange={(e) => patchAdditional({ paidAmount: e.target.value.replace(/[^\d.,]/g, '') })} />
          </Field>
          <Field label="За месяцев">
            <input className="input mono" inputMode="numeric" value={draft.additional.paidMonths} onChange={(e) => patchAdditional({ paidMonths: e.target.value.replace(/\D/g, '') })} />
          </Field>

          <Field label="Банк">
            <input className="input" value={draft.additional.bank} onChange={(e) => patchAdditional({ bank: e.target.value })} />
          </Field>
          <Field label="№ счёта" full>
            <input className="input mono" value={draft.additional.accountNumber} onChange={(e) => patchAdditional({ accountNumber: e.target.value })} />
          </Field>

          <Field label="Форма обучения">
            <select className="select" value={draft.additional.educationForm} onChange={(e) => patchAdditional({ educationForm: e.target.value as EducationForm })}>
              <option value="">—</option>
              {(Object.keys(EDU_FORM_LABELS) as Array<keyof typeof EDU_FORM_LABELS>).map((k) => (
                <option key={k} value={k}>{EDU_FORM_LABELS[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="Льготы">
            <input className="input" placeholder="нет" value={draft.additional.benefits} onChange={(e) => patchAdditional({ benefits: e.target.value })} />
          </Field>
          <Field label="Специальность">
            <input className="input" value={draft.additional.specialty} onChange={(e) => patchAdditional({ specialty: e.target.value })} />
          </Field>

          <Field label="Потребность в общежитии" full>
            <label className="row" style={{ gap: 'var(--s-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={draft.additional.needsDormitory}
                onChange={(e) => patchAdditional({ needsDormitory: e.target.checked })}
              />
              <span style={{ fontSize: 'var(--fs-13)' }}>Нужно общежитие</span>
            </label>
          </Field>

          <Field label="Примечание" full>
            <textarea className="textarea" rows={2} value={draft.additional.note} onChange={(e) => patchAdditional({ note: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      {/* 10. ВОИНСКИЙ УЧЁТ */}
      <FormSection icon={ShieldCheck} title="Воинский учёт" defaultOpen={false}>
        <div className="grid-form">
          <Field label="Отношение к воинской обязанности">
            <select className="select" value={draft.military.status} onChange={(e) => patchMilitary({ status: e.target.value as MilStatus })}>
              <option value="">—</option>
              <option value="liable">военнообязан</option>
              <option value="reserve">в запасе</option>
              <option value="not_liable">не военнообязан</option>
            </select>
          </Field>
          <Field label="Категория годности">
            <input className="input mono" maxLength={2} value={draft.military.category} onChange={(e) => patchMilitary({ category: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Воинское звание">
            <input className="input" value={draft.military.rank} onChange={(e) => patchMilitary({ rank: e.target.value })} />
          </Field>
          <Field label="Военный комиссариат" full>
            <input className="input" value={draft.military.commissariat} onChange={(e) => patchMilitary({ commissariat: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      <style jsx>{`
        .grid-form {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--s-4);
        }
        .grid-form :global(.field-full) {
          grid-column: 1 / -1;
        }
        @media (max-width: 720px) {
          .grid-form { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}

/* ────────── presentation ────────── */

function Field({
  label, hint, required, full, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`field${full ? ' field-full' : ''}`}>
      <label className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

/* ────────── helpers ────────── */

function formatSnils(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const e = d.slice(9, 11);
  let out = a;
  if (b) out += '-' + b;
  if (c) out += '-' + c;
  if (e) out += ' ' + e;
  return out;
}

function formatDivisionCode(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6);
  return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}

const REQUIRED_FIELDS_TOTAL = 12;

function countRequiredFilled(d: Draft): number {
  let n = 0;
  if (d.photo) n++;
  if (d.lastName.trim()) n++;
  if (d.firstName.trim()) n++;
  if (d.birthDate) n++;
  if (d.birthPlace.trim()) n++;
  if (d.gender) n++;
  if (/^\d{3}-\d{3}-\d{3} \d{2}$/.test(d.snils)) n++;
  if (/^\d{4}$/.test(d.passport.series)) n++;
  if (/^\d{6}$/.test(d.passport.number)) n++;
  if (d.passport.issuedDate) n++;
  if (/^\d{3}-\d{3}$/.test(d.passport.divisionCode)) n++;
  if (d.passport.issuedBy.trim()) n++;
  return n;
}

/** Глубокий merge для восстановления черновика после расширения схемы. */
function mergeDraft(base: Draft, raw: unknown): Draft {
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Draft>;
  return {
    ...base,
    ...r,
    passport: { ...base.passport, ...(r.passport ?? {}) },
    residence: { ...base.residence, ...(r.residence ?? {}) },
    parents: Array.isArray(r.parents) ? r.parents : base.parents,
    representative: {
      ...base.representative,
      ...(r.representative ?? {}),
      passport: {
        ...base.representative.passport,
        ...((r.representative as Representative | undefined)?.passport ?? {}),
      },
    },
    education: Array.isArray(r.education) ? r.education : base.education,
    questionnaire: { ...base.questionnaire, ...(r.questionnaire ?? {}) },
    additional: { ...base.additional, ...(r.additional ?? {}) },
    military: { ...base.military, ...(r.military ?? {}) },
  };
}

/** Преобразует строковые поля в типы DTO (числа), пустые секции опускает. */
function serializeForApi(d: Draft): Record<string, unknown> {
  const num = (s: string): number | undefined => {
    if (!s.trim()) return undefined;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };
  const intn = (s: string): number | undefined => {
    if (!s.trim()) return undefined;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  };

  const repFilled =
    d.representative.lastName.trim() ||
    d.representative.firstName.trim() ||
    d.representative.address.trim() ||
    d.representative.birthDate;

  const qFilled =
    d.questionnaire.medal.trim() ||
    d.questionnaire.olympicChampion.trim() ||
    d.questionnaire.workYears || d.questionnaire.workMonths ||
    d.questionnaire.specialtyYears || d.questionnaire.specialtyMonths ||
    d.questionnaire.foreignLanguages.trim() ||
    d.questionnaire.spoLevel;

  const aFilled =
    d.additional.receiptNumber.trim() ||
    d.additional.paidAmount.trim() ||
    d.additional.paidMonths.trim() ||
    d.additional.bank.trim() ||
    d.additional.accountNumber.trim() ||
    d.additional.needsDormitory ||
    d.additional.educationForm ||
    d.additional.benefits.trim() ||
    d.additional.specialty.trim() ||
    d.additional.note.trim();

  const mFilled =
    d.military.status || d.military.category.trim() ||
    d.military.rank.trim() || d.military.commissariat.trim();

  const resFilled = d.residence.phone.trim() || d.residence.address.trim();

  return {
    photo: d.photo,
    lastName: d.lastName.trim(),
    firstName: d.firstName.trim(),
    middleName: d.middleName.trim() || undefined,
    birthDate: d.birthDate,
    birthPlace: d.birthPlace.trim(),
    gender: d.gender,
    inn: d.inn || undefined,
    snils: d.snils,
    registrationNumber: d.registrationNumber || undefined,
    caseNumber: d.caseNumber || undefined,

    passport: {
      series: d.passport.series,
      number: d.passport.number,
      issuedBy: d.passport.issuedBy.trim(),
      issuedDate: d.passport.issuedDate,
      divisionCode: d.passport.divisionCode,
      citizenship: d.passport.citizenship.trim() || undefined,
      registrationAddress: d.passport.registrationAddress.trim() || undefined,
    },

    residence: resFilled ? d.residence : undefined,
    parents: d.parents.length ? d.parents : undefined,

    representative: repFilled ? d.representative : undefined,

    education: d.education.length
      ? d.education.map((e) => ({
          institution: e.institution || undefined,
          graduationYear: intn(e.graduationYear),
          averageGrade: num(e.averageGrade),
          documentType: e.documentType || undefined,
          documentSeries: e.documentSeries || undefined,
          documentNumber: e.documentNumber || undefined,
          documentIssueDate: e.documentIssueDate || undefined,
          institutionType: e.institutionType || undefined,
        }))
      : undefined,

    questionnaire: qFilled
      ? {
          medal: d.questionnaire.medal || undefined,
          olympicChampion: d.questionnaire.olympicChampion || undefined,
          workYears: intn(d.questionnaire.workYears),
          workMonths: intn(d.questionnaire.workMonths),
          specialtyYears: intn(d.questionnaire.specialtyYears),
          specialtyMonths: intn(d.questionnaire.specialtyMonths),
          foreignLanguages: d.questionnaire.foreignLanguages || undefined,
          spoLevel: d.questionnaire.spoLevel || undefined,
        }
      : undefined,

    additional: aFilled
      ? {
          receiptNumber: d.additional.receiptNumber || undefined,
          paidAmount: num(d.additional.paidAmount),
          paidMonths: intn(d.additional.paidMonths),
          bank: d.additional.bank || undefined,
          accountNumber: d.additional.accountNumber || undefined,
          needsDormitory: d.additional.needsDormitory,
          educationForm: d.additional.educationForm || undefined,
          benefits: d.additional.benefits || undefined,
          specialty: d.additional.specialty || undefined,
          note: d.additional.note || undefined,
        }
      : undefined,

    military: mFilled ? d.military : undefined,

    status: 'SUBMITTED',
  };
}
