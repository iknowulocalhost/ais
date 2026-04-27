'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';

type Status = 'DRAFT' | 'SUBMITTED' | 'ENROLLED' | 'REJECTED';

interface ApplicantFull {
  id: string;
  status: Status;
  payload: Record<string, unknown> & { photo?: string | null; lastName: string; firstName: string; middleName?: string | null };
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'черновик',
  SUBMITTED: 'подана',
  ENROLLED: 'зачислен',
  REJECTED: 'отклонён',
};

export default function AdmissionsDetailPage() {
  const { hasRole } = useAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<ApplicantFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole(['SUPERADMIN', 'COM']) || !id) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<ApplicantFull>(`/api/admissions/${id}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, hasRole]);

  if (!hasRole(['SUPERADMIN', 'COM'])) {
    return (
      <div className="col" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--s-7)', gap: 'var(--s-3)', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 'var(--fs-22)' }}>Недостаточно прав</h1>
        <p className="muted" style={{ fontSize: 'var(--fs-14)' }}>Личные дела абитуриентов доступны только администратору.</p>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 'var(--s-5)', maxWidth: 1040 }}>
      <Link href="/admissions/list" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} strokeWidth={1.75} /> К реестру
      </Link>

      {loading && <div className="muted" style={{ fontSize: 'var(--fs-13)' }}>Загрузка…</div>}

      {error && (
        <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', borderColor: 'var(--ais-ember)', color: 'var(--ais-ember)' }}>
          {error}
        </div>
      )}

      {data && <Dossier data={data} />}
    </div>
  );
}

function Dossier({ data }: { data: ApplicantFull }) {
  const p = data.payload as Record<string, unknown>;
  const photo = (p.photo as string | null) ?? null;
  const fio = `${data.payload.lastName} ${data.payload.firstName} ${data.payload.middleName ?? ''}`.trim();

  return (
    <div className="col" style={{ gap: 'var(--s-5)' }}>
      <header className="card" style={{ padding: 'var(--s-5)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--s-5)', alignItems: 'center' }}>
        <div style={{
          width: 120, height: 120, borderRadius: 'var(--r-8)', overflow: 'hidden',
          background: 'var(--ais-paper-2)', border: '1px solid var(--ais-line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={fio} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>нет фото</span>
          )}
        </div>
        <div className="col" style={{ gap: 'var(--s-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ais-bone-4)' }}>
            личное дело · {data.id.slice(0, 8)}
          </div>
          <h1 className="display" style={{ fontSize: 'var(--fs-28)', margin: 0 }}>{fio || '—'}</h1>
          <div className="row" style={{ gap: 'var(--s-3)', fontSize: 'var(--fs-13)', color: 'var(--ais-bone-3)' }}>
            <span className={`badge ${data.status === 'ENROLLED' ? 'badge--ok' : data.status === 'REJECTED' ? 'badge--err' : ''}`}>
              {STATUS_LABEL[data.status]}
            </span>
            <span className="mono tnum">создано {new Date(data.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>
      </header>

      <Section title="Студент">
        <Row k="Дата рождения" v={p.birthDate as string} />
        <Row k="Место рождения" v={p.birthPlace as string} />
        <Row k="Пол" v={p.gender === 'M' ? 'мужской' : p.gender === 'F' ? 'женский' : '—'} />
        <Row k="СНИЛС" v={p.snils as string} mono />
        <Row k="ИНН" v={(p.inn as string) ?? '—'} mono />
        <Row k="Регистрационный №" v={(p.registrationNumber as string) ?? '—'} mono />
        <Row k="Дело №" v={(p.caseNumber as string) ?? '—'} mono />
      </Section>

      {p.passport ? <PassportBlock pp={p.passport as Record<string, string>} /> : null}
      {p.residence ? <ResidenceBlock r={p.residence as Record<string, string>} /> : null}
      {Array.isArray(p.parents) && p.parents.length > 0 ? <ParentsBlock parents={p.parents as Record<string, string>[]} /> : null}
      {Array.isArray(p.education) && p.education.length > 0 ? <EducationBlock list={p.education as Record<string, unknown>[]} /> : null}
      {p.questionnaire ? <KvBlock title="Анкета" obj={p.questionnaire as Record<string, unknown>} /> : null}
      {p.additional ? <KvBlock title="Дополнительно" obj={p.additional as Record<string, unknown>} /> : null}
      {p.military ? <KvBlock title="Воинский учёт" obj={p.military as Record<string, unknown>} /> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 'var(--s-5)' }}>
      <h2 style={{ margin: '0 0 var(--s-3)', fontSize: 'var(--fs-16)', fontWeight: 600 }}>{title}</h2>
      <div className="col" style={{ gap: 'var(--s-2)' }}>{children}</div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'baseline', borderBottom: '1px dashed var(--ais-line)', paddingBottom: 6 }}>
      <span className="muted" style={{ minWidth: 200, fontSize: 'var(--fs-13)' }}>{k}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: 'var(--fs-14)' }}>{v == null || v === '' ? '—' : String(v)}</span>
    </div>
  );
}

function PassportBlock({ pp }: { pp: Record<string, string> }) {
  return (
    <Section title="Паспорт">
      <Row k="Серия / номер" v={`${pp.series ?? ''} ${pp.number ?? ''}`.trim()} mono />
      <Row k="Код подразделения" v={pp.divisionCode} mono />
      <Row k="Дата выдачи" v={pp.issuedDate} />
      <Row k="Кем выдан" v={pp.issuedBy} />
      <Row k="Гражданство" v={pp.citizenship} />
      <Row k="Прописка" v={pp.registrationAddress} />
    </Section>
  );
}

function ResidenceBlock({ r }: { r: Record<string, string> }) {
  return (
    <Section title="Адрес проживания">
      <Row k="Телефон" v={r.phone} mono />
      <Row k="Адрес" v={r.address} />
    </Section>
  );
}

function ParentsBlock({ parents }: { parents: Record<string, string>[] }) {
  const KIND: Record<string, string> = { mother: 'мать', father: 'отец', guardian: 'опекун', other: 'иное' };
  return (
    <Section title="Родители">
      {parents.map((p, i) => (
        <div key={i} className="col" style={{ gap: 'var(--s-2)', paddingTop: i > 0 ? 'var(--s-3)' : 0, borderTop: i > 0 ? '1px solid var(--ais-line)' : 'none' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-13)' }}>{KIND[p.kind] ?? p.kind}</div>
          <Row k="ФИО" v={`${p.lastName ?? ''} ${p.firstName ?? ''} ${p.middleName ?? ''}`.trim()} />
          <Row k="Телефон" v={p.phone} mono />
          <Row k="Адрес" v={p.address} />
          <Row k="Работа" v={p.work} />
        </div>
      ))}
    </Section>
  );
}

function EducationBlock({ list }: { list: Record<string, unknown>[] }) {
  return (
    <Section title="Учебные заведения">
      {list.map((e, i) => (
        <div key={i} className="col" style={{ gap: 'var(--s-2)', paddingTop: i > 0 ? 'var(--s-3)' : 0, borderTop: i > 0 ? '1px solid var(--ais-line)' : 'none' }}>
          <Row k="Учреждение" v={e.institution as string} />
          <Row k="Тип" v={e.institutionType as string} />
          <Row k="Год окончания" v={e.graduationYear as number} mono />
          <Row k="Средний балл" v={e.averageGrade as number} mono />
          <Row k="Документ" v={`${e.documentType ?? ''} ${e.documentSeries ?? ''} ${e.documentNumber ?? ''}`.trim()} />
          <Row k="Дата выдачи" v={e.documentIssueDate as string} />
        </div>
      ))}
    </Section>
  );
}

function KvBlock({ title, obj }: { title: string; obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== '' && v !== undefined && v !== false);
  if (entries.length === 0) return null;
  return (
    <Section title={title}>
      {entries.map(([k, v]) => (
        <Row key={k} k={k} v={typeof v === 'boolean' ? (v ? 'да' : 'нет') : (v as string | number)} />
      ))}
    </Section>
  );
}
