'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import { Protected } from '@/components/protected';
import { apiFetch, ApiError } from '@/lib/api';
import { explainError } from '@/lib/errors';

// ─────── типы ответов API ───────

interface MirrorGroup {
  externalId: number; name: string; yearNumber: number | null;
  educationForm: string | null; isActive: boolean;
}

interface AttPerson { id: number; firstName: string; lastName: string; middleName?: string }
interface AttSubject {
  id: number;
  name: string;
  examinationType?: string;
  teacher?: AttPerson;
  marks?: Record<string, { value?: string; isRequired?: boolean }>;
}
interface AttestationData { students: AttPerson[]; subjects: AttSubject[] }

interface RatingStudent extends AttPerson {
  attendance?: { allMissed?: number; missedForInvalidReason?: number };
  progress?: { certified?: number; notCertified?: number };
}
interface RatingData { students: RatingStudent[] }

interface SimpleListItem { id: number; name: string }

// ─────── переводы enum'ов ───────

const MARK_LABELS: Record<string, string> = {
  Five: '5', Four: '4', Three: '3', Two: '2', One: '1', Zero: '0',
  Excellent: '5', Good: '4', Satisfactory: '3', Unsatisfactory: '2',
  Excused: 'осв.', Absent: 'н/а', None: '—',
};

const EXAM_TYPE_LABELS: Record<string, string> = {
  Other: 'Зачёт',
  Test: 'Зачёт',
  DifferentiatedTest: 'Диф. зачёт',
  Examination: 'Экзамен',
  CourseWork: 'Курсовая',
  Practice: 'Практика',
  GraduationWork: 'ВКР',
};

const REPORT_TITLES: Record<string, string> = {
  'group-attestation': 'Аттестационная ведомость',
  'current-progress': 'Ведомость текущей успеваемости',
  'attendance': 'Ведомость посещаемости',
  'rating': 'Рейтинг учебной группы',
  'debts': 'Список задолженностей',
  'group-students': 'Список учебной группы',
};

// ─────── шапка/футер ───────

const ORG_NAME_FULL =
  'Государственное профессиональное образовательное учреждение ' +
  '«Читинский техникум отраслевых технологий и бизнеса»';
const ORG_NAME_SHORT = 'ГПОУ «ЧТОТиБ»';
const MINISTRY = 'Министерство образования и науки Забайкальского края';

// ─────── страница ───────

export default function ReportPrintPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'ADMINISTRATION', 'COM', 'TEA']}>
      <ReportPrintView />
    </Protected>
  );
}

function ReportPrintView() {
  const params = useSearchParams();
  const type = params?.get('type') ?? 'group-attestation';
  const groupId = Number(params?.get('groupId') ?? 0);
  const term = Number(params?.get('term') ?? 0);
  const date = params?.get('date') ?? '';

  const [group, setGroup] = useState<MirrorGroup | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!groupId) { setError('Не указана группа.'); setBusy(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [groups, payload] = await Promise.all([
          apiFetch<MirrorGroup[]>('/api/poozabeduapi/mirror/groups'),
          apiFetch<unknown>('/api/poozabeduapi/reports', { query: { path: pathFor(type, groupId, term, date) } }),
        ]);
        if (cancelled) return;
        setGroup(groups.find((g) => g.externalId === groupId) ?? null);
        setData(payload);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : explainError(e).hint);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, groupId, term, date]);

  const title = REPORT_TITLES[type] ?? 'Ведомость';
  const periodLabel = useMemo(() => {
    if (type === 'rating' || type === 'group-attestation') {
      const t = term === 1 ? 'I семестр' : term === 2 ? 'II семестр' : '';
      return [t, date && `по состоянию на ${fmtDateRu(date)}`].filter(Boolean).join(' · ');
    }
    return '';
  }, [type, term, date]);

  return (
    <>
      <PrintStyles />
      <div className="print-toolbar">
        <button type="button" onClick={() => window.close()} className="btn btn--ghost btn--sm">
          <ArrowLeft size={14} strokeWidth={1.75} /> Закрыть
        </button>
        <button type="button" onClick={() => window.print()} className="btn btn--primary btn--sm" disabled={busy || !!error}>
          <Printer size={14} strokeWidth={1.75} /> Печать
        </button>
      </div>

      <div className="print-page">
        <Header />
        <h1 className="report-title">{title}</h1>
        {group && (
          <p className="report-subtitle">
            учебной группы <b>{group.name}</b>
            {group.yearNumber !== null && <>, {group.yearNumber} курс</>}
            {periodLabel && <>, {periodLabel}</>}
          </p>
        )}

        {busy && <p className="muted-print">Загружаем данные…</p>}
        {error && <p className="error-print">{error}</p>}

        {!busy && !error && data !== null && (
          <ReportBody type={type} data={data} />
        )}

        <Footer />
      </div>
    </>
  );
}

function ReportBody({ type, data }: { type: string; data: unknown }) {
  if (type === 'group-attestation' || type === 'current-progress') {
    return <AttestationTable data={data as AttestationData} />;
  }
  if (type === 'attendance') return <AttendanceTable data={data as RatingData} />;
  if (type === 'rating') return <RatingTable data={data as RatingData} />;
  if (type === 'debts') return <DebtsTable data={data as RatingData} />;
  if (type === 'group-students') return <StudentsList data={data as SimpleListItem[]} />;
  return <pre className="raw">{JSON.stringify(data, null, 2)}</pre>;
}

// ─────── тело ведомостей ───────

function AttestationTable({ data }: { data: AttestationData }) {
  if (!data?.students || !data?.subjects) {
    return <p className="muted-print">Данные ведомости пусты.</p>;
  }
  const students = [...data.students].sort(byLastName);
  const subjects = data.subjects;
  if (subjects.length === 0) {
    return <p className="muted-print">Сетевой ПОО не вернул ни одной дисциплины для группы за выбранный период.</p>;
  }
  return (
    <>
      <table className="rep-table">
        <thead>
          <tr>
            <th rowSpan={2} className="num">№</th>
            <th rowSpan={2} className="fio">Фамилия, имя, отчество</th>
            {subjects.map((s) => (
              <th key={s.id} className="subj">
                <div className="subj-name">{s.name}</div>
                {s.examinationType && (
                  <div className="subj-exam">{EXAM_TYPE_LABELS[s.examinationType] ?? s.examinationType}</div>
                )}
              </th>
            ))}
          </tr>
          <tr>
            {subjects.map((s) => (
              <th key={s.id} className="subj-teacher">
                {s.teacher ? `${s.teacher.lastName} ${initial(s.teacher.firstName)}${s.teacher.middleName ? ` ${initial(s.teacher.middleName)}` : ''}` : '—'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id}>
              <td className="num">{i + 1}</td>
              <td className="fio">{`${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ''}`}</td>
              {subjects.map((subj) => {
                const m = subj.marks?.[String(s.id)];
                const v = m?.value;
                return <td key={subj.id} className="mark">{v ? (MARK_LABELS[v] ?? v) : '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="report-note">
        Условные обозначения: 5 — отлично, 4 — хорошо, 3 — удовлетворительно, 2 — неудовлетворительно,
        н/а — не аттестован, осв. — освобождён.
      </p>
    </>
  );
}

function RatingTable({ data }: { data: RatingData }) {
  if (!data?.students) return <p className="muted-print">Данные рейтинга пусты.</p>;
  const students = [...data.students].sort((a, b) => {
    const ac = a.progress?.certified ?? 0;
    const bc = b.progress?.certified ?? 0;
    if (bc !== ac) return bc - ac;
    return byLastName(a, b);
  });
  return (
    <>
      <table className="rep-table">
        <thead>
          <tr>
            <th className="num" rowSpan={2}>№</th>
            <th className="fio" rowSpan={2}>Фамилия, имя, отчество</th>
            <th colSpan={2}>Аттестация</th>
            <th colSpan={2}>Пропущено часов</th>
          </tr>
          <tr>
            <th>Аттестован</th>
            <th>Не аттестован</th>
            <th>Всего</th>
            <th>Без уважительной причины</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id}>
              <td className="num">{i + 1}</td>
              <td className="fio">{`${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ''}`}</td>
              <td className="num">{s.progress?.certified ?? 0}</td>
              <td className="num">{s.progress?.notCertified ?? 0}</td>
              <td className="num">{s.attendance?.allMissed ?? 0}</td>
              <td className="num">{s.attendance?.missedForInvalidReason ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function AttendanceTable({ data }: { data: RatingData }) {
  if (!data?.students) return <p className="muted-print">Данные о посещаемости пусты.</p>;
  const students = [...data.students].sort(byLastName);
  const totalAll = students.reduce((acc, s) => acc + (s.attendance?.allMissed ?? 0), 0);
  const totalInvalid = students.reduce((acc, s) => acc + (s.attendance?.missedForInvalidReason ?? 0), 0);
  return (
    <>
      <table className="rep-table">
        <thead>
          <tr>
            <th className="num" rowSpan={2}>№</th>
            <th className="fio" rowSpan={2}>Фамилия, имя, отчество</th>
            <th colSpan={3}>Пропущено часов</th>
          </tr>
          <tr>
            <th>Всего</th>
            <th>По уважительной причине</th>
            <th>Без уважительной причины</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const all = s.attendance?.allMissed ?? 0;
            const invalid = s.attendance?.missedForInvalidReason ?? 0;
            const valid = Math.max(0, all - invalid);
            return (
              <tr key={s.id}>
                <td className="num">{i + 1}</td>
                <td className="fio">{`${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ''}`}</td>
                <td className="num">{all || '—'}</td>
                <td className="num">{valid || '—'}</td>
                <td className="num">{invalid || '—'}</td>
              </tr>
            );
          })}
          <tr>
            <td className="num"></td>
            <td className="fio" style={{ fontStyle: 'italic' }}>Итого по группе</td>
            <td className="num"><b>{totalAll || '—'}</b></td>
            <td className="num"><b>{Math.max(0, totalAll - totalInvalid) || '—'}</b></td>
            <td className="num"><b>{totalInvalid || '—'}</b></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function DebtsTable({ data }: { data: RatingData }) {
  if (!data?.students) return <p className="muted-print">Данные о задолженностях пусты.</p>;
  const students = data.students
    .filter((s) => (s.progress?.notCertified ?? 0) > 0)
    .sort((a, b) => {
      const an = a.progress?.notCertified ?? 0;
      const bn = b.progress?.notCertified ?? 0;
      if (bn !== an) return bn - an;
      return byLastName(a, b);
    });
  if (students.length === 0) {
    return <p className="muted-print">В группе нет студентов с задолженностями за выбранный период.</p>;
  }
  return (
    <>
      <table className="rep-table">
        <thead>
          <tr>
            <th className="num" rowSpan={2}>№</th>
            <th className="fio" rowSpan={2}>Фамилия, имя, отчество</th>
            <th colSpan={2}>Аттестация</th>
            <th colSpan={2}>Пропуски (часы)</th>
          </tr>
          <tr>
            <th>Не аттестован</th>
            <th>Аттестован</th>
            <th>Всего</th>
            <th>Без уваж. причины</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id}>
              <td className="num">{i + 1}</td>
              <td className="fio">{`${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ''}`}</td>
              <td className="num"><b>{s.progress?.notCertified ?? 0}</b></td>
              <td className="num">{s.progress?.certified ?? 0}</td>
              <td className="num">{s.attendance?.allMissed ?? 0}</td>
              <td className="num">{s.attendance?.missedForInvalidReason ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="report-note">
        Список включает студентов, имеющих хотя бы одну запись «не аттестован» по итогам выбранного семестра.
        Сортировка — по числу несданных дисциплин, затем по фамилии.
      </p>
    </>
  );
}

function StudentsList({ data }: { data: SimpleListItem[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="muted-print">Список пуст.</p>;
  }
  const students = [...data].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return (
    <table className="rep-table">
      <thead>
        <tr>
          <th className="num">№</th>
          <th className="fio">Фамилия, имя, отчество</th>
        </tr>
      </thead>
      <tbody>
        {students.map((s, i) => (
          <tr key={s.id}>
            <td className="num">{i + 1}</td>
            <td className="fio">{s.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─────── шапка/подвал ───────

function Header() {
  return (
    <div className="rep-header">
      <p className="rep-ministry">{MINISTRY}</p>
      <p className="rep-org">{ORG_NAME_FULL}</p>
      <p className="rep-org-short">({ORG_NAME_SHORT})</p>
    </div>
  );
}

function Footer() {
  return (
    <div className="rep-footer">
      <div className="rep-sign-row">
        <span>Заместитель директора по УПР</span>
        <span className="rep-sign-line" />
        <span>/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/</span>
      </div>
      <div className="rep-sign-row">
        <span>Классный руководитель</span>
        <span className="rep-sign-line" />
        <span>/&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/</span>
      </div>
      <p className="rep-date">Дата составления:&nbsp;<span className="rep-sign-line short" /></p>
    </div>
  );
}

// ─────── helpers ───────

function pathFor(type: string, groupId: number, term: number, date: string): string {
  const t = term || 2;
  const d = date || todayIso();
  switch (type) {
    case 'group-attestation':
      // префикс Semester/{term}/{date} даёт срез семестра, без него — за всё время обучения
      return `curator/group-attestation/Semester/${t}/${d}/${groupId}`;
    case 'current-progress':
      return `curator/group-current-progress/Semester/${t}/${d}/${groupId}`;
    case 'attendance':
      return `curator/group-attendance/Semester/${t}/${d}/${groupId}`;
    case 'rating':
      return `curator/rating/Semester/${t}/${d}/${groupId}`;
    case 'debts':
      // тот же эндпоинт, что rating; фильтр notCertified — на клиенте
      return `curator/rating/Semester/${t}/${d}/${groupId}`;
    case 'group-students':
      return `group/${groupId}/students`;
    default:
      return `group/${groupId}/students`;
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
function initial(name?: string): string {
  return name ? `${name[0]}.` : '';
}
function byLastName(a: { lastName: string; firstName: string }, b: { lastName: string; firstName: string }): number {
  const c = a.lastName.localeCompare(b.lastName, 'ru');
  return c !== 0 ? c : a.firstName.localeCompare(b.firstName, 'ru');
}

// ─────── стили ───────

function PrintStyles() {
  return (
    <style jsx global>{`
      @page { size: A4 portrait; margin: 18mm 15mm 18mm 18mm; }

      .print-toolbar {
        position: sticky; top: 0; z-index: 10;
        display: flex; gap: var(--s-3); align-items: center; justify-content: flex-end;
        padding: var(--s-3) var(--s-4);
        background: var(--ais-veil);
        border-bottom: 1px solid var(--ais-line);
      }

      .print-page {
        background: #fff; color: #000;
        font-family: "Times New Roman", Times, serif;
        font-size: 11pt; line-height: 1.35;
        padding: 12mm 14mm;
        max-width: 200mm;
        margin: 0 auto var(--s-7);
      }

      .rep-header { text-align: center; margin-bottom: 10mm; }
      .rep-header p { margin: 0; }
      .rep-ministry { font-size: 10pt; }
      .rep-org { font-weight: 700; font-size: 11pt; margin-top: 2pt; }
      .rep-org-short { font-size: 10pt; margin-top: 2pt; }

      .report-title { font-size: 14pt; font-weight: 700; text-align: center; margin: 6mm 0 2mm; }
      .report-subtitle { text-align: center; margin: 0 0 6mm; font-size: 11pt; }
      .report-note { font-size: 9pt; margin-top: 4mm; color: #555; }

      .muted-print { color: #555; font-style: italic; }
      .error-print { color: #a02a2a; }
      .raw { font-size: 9pt; white-space: pre-wrap; word-break: break-word; }

      .rep-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
      .rep-table th, .rep-table td {
        border: 1px solid #000;
        padding: 3pt 4pt;
        vertical-align: middle;
      }
      .rep-table thead th { font-weight: 600; background: #f4f4f4; text-align: center; }
      .rep-table .num { width: 28pt; text-align: center; }
      .rep-table .mark { width: 28pt; text-align: center; }
      .rep-table .fio { text-align: left; }
      .rep-table .subj-name { font-weight: 600; }
      .rep-table .subj-exam { font-size: 8pt; font-weight: 400; color: #555; }
      .rep-table .subj-teacher { font-weight: 400; font-size: 8pt; }

      .rep-footer { margin-top: 14mm; }
      .rep-sign-row {
        display: flex; align-items: baseline; gap: 8mm;
        margin-bottom: 6mm;
      }
      .rep-sign-line {
        flex: 1;
        border-bottom: 1px solid #000;
        height: 12pt;
      }
      .rep-sign-line.short { display: inline-block; width: 35mm; vertical-align: bottom; }
      .rep-date { margin-top: 8mm; font-size: 11pt; }

      @media print {
        .print-toolbar { display: none !important; }
        :global(.app-shell aside),
        :global(.app-header) { display: none !important; }
        :global(.app-main), :global(body) {
          background: #fff !important; padding: 0 !important; margin: 0 !important;
        }
        .print-page {
          padding: 0; margin: 0; max-width: none;
        }
      }
    `}</style>
  );
}
