/**
 * Доменные типы/форматтеры — зеркалят backend.
 * Держим отдельно от types.ts (там auth-специфичное), чтобы страницы
 * импортировали точечно.
 */

export type StudentStatus =
  | 'APPLICANT'
  | 'ENROLLED'
  | 'ACADEMIC_LEAVE'
  | 'EXPELLED'
  | 'GRADUATED';

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  APPLICANT: 'Абитуриент',
  ENROLLED: 'Зачислен',
  ACADEMIC_LEAVE: 'Академ. отпуск',
  EXPELLED: 'Отчислен',
  GRADUATED: 'Выпускник',
};

export interface Student {
  id: string;
  userId: string | null;
  groupId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string;
  status: StudentStatus;
  avatarObjectKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentKind = 'PASSPORT' | 'SNILS' | 'EDU_CERTIFICATE' | 'MEDICAL' | 'PHOTO' | 'OTHER';
export type DocumentStatus = 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  PASSPORT: 'Паспорт',
  SNILS: 'СНИЛС',
  EDU_CERTIFICATE: 'Аттестат/диплом',
  MEDICAL: 'Медсправка',
  PHOTO: 'Фото',
  OTHER: 'Иное',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Ожидает загрузки',
  UPLOADED: 'Загружен',
  VERIFIED: 'Подтверждён',
  REJECTED: 'Отклонён',
};

export interface StudentDocument {
  id: string;
  studentId: string;
  kind: DocumentKind;
  status: DocumentStatus;
  originalName: string;
  contentType: string;
  sizeBytes: number | string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentPurpose = 'TUITION' | 'DORM' | 'FINE' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  TUITION: 'Обучение',
  DORM: 'Общежитие',
  FINE: 'Штраф',
  OTHER: 'Иное',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Ожидает',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
  REFUNDED: 'Возврат',
};

export interface Payment {
  id: string;
  studentId: string;
  purpose: PaymentPurpose;
  amountKopecks: string; // backend отдаёт bigint как строку
  currency: string;
  status: PaymentStatus;
  dueDate: string;
  paidAt: string | null;
  externalRef: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReportKind = 'STUDENTS_ROSTER' | 'PAYMENTS_LEDGER';
export type ReportStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  STUDENTS_ROSTER: 'Реестр студентов',
  PAYMENTS_LEDGER: 'Реестр платежей',
};

export interface ReportExport {
  id: string;
  kind: ReportKind;
  requestedBy: string;
  params: Record<string, unknown>;
  status: ReportStatus;
  objectKey: string | null;
  errorMessage: string | null;
  downloadUrl: string | null;
  ttlSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Curriculum & Grades ─────────────────────────────────

export type CurriculumPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ControlForm = 'EXAM' | 'CREDIT' | 'DIFF_CREDIT' | 'COURSEWORK';
export type GradeSheetStatus = 'OPEN' | 'CLOSED';

export const CURRICULUM_PLAN_STATUS_LABELS: Record<CurriculumPlanStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Действует',
  ARCHIVED: 'Архив',
};

export const CONTROL_FORM_LABELS: Record<ControlForm, string> = {
  EXAM: 'Экзамен',
  CREDIT: 'Зачёт',
  DIFF_CREDIT: 'Дифф. зачёт',
  COURSEWORK: 'Курсовая',
};

export const GRADE_SHEET_STATUS_LABELS: Record<GradeSheetStatus, string> = {
  OPEN: 'Открыта',
  CLOSED: 'Закрыта',
};

export const GRADE_VALUE_LABELS: Record<number, string> = {
  0: 'Не зачтено',
  1: 'Зачтено',
  2: 'Неудовл.',
  3: 'Удовл.',
  4: 'Хорошо',
  5: 'Отлично',
};

export interface Discipline {
  id: string;
  code: string;
  name: string;
  totalHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumPlan {
  id: string;
  programCode: string;
  admissionYear: number;
  name: string;
  status: CurriculumPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumEntry {
  id: string;
  planId: string;
  disciplineId: string;
  semester: number;
  controlForm: ControlForm;
  hours: number;
  createdAt: string;
}

export interface GradeSheet {
  id: string;
  groupId: string;
  curriculumEntryId: string;
  teacherId: string;
  date: string;
  status: GradeSheetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Grade {
  id: string;
  sheetId: string;
  studentId: string;
  value: number | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** «12345» (копеек) → «123,45 ₽» */
export function formatKopecks(kop: string | number | bigint): string {
  const n = typeof kop === 'bigint' ? kop : BigInt(String(kop));
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const rub = abs / 100n;
  const cop = (abs % 100n).toString().padStart(2, '0');
  const s = `${rub.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')},${cop} ₽`;
  return neg ? `−${s}` : s;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}
