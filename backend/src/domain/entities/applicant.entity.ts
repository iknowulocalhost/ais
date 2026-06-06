export type ApplicantStatus = 'DRAFT' | 'SUBMITTED' | 'ENROLLED' | 'REJECTED';

/* ── Паспорт ── */
export interface ApplicantPassport {
  series: string;
  number: string;
  issuedBy: string;
  issuedDate: string;        // ISO yyyy-mm-dd
  divisionCode: string;
  citizenship: string;       // например «РФ»
  registrationAddress: string; // прописка
}

/* ── Родитель ── */
export type ParentKind = 'mother' | 'father' | 'guardian' | 'other';
export interface ApplicantParent {
  kind: ParentKind;
  lastName: string;
  firstName: string;
  middleName: string;
  address: string;
  work: string;
  phone: string;
}

/* ── Представитель ── */
export type RepresentativeSource = 'student' | 'parent1' | 'parent2' | 'custom';
export interface ApplicantRepresentative {
  source: RepresentativeSource;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  address: string;
  passport: {
    series: string;
    number: string;
    issuedBy: string;
    issuedDate: string;
  };
}

/* ── Учебное заведение ── */
export interface ApplicantEducation {
  institution: string;
  graduationYear: number | null;
  averageGrade: number | null;
  documentType: string;     // «Аттестат 11кл», «Диплом СПО»…
  documentSeries: string;
  documentNumber: string;
  documentIssueDate: string;
  institutionType: string;  // «общеобразовательное учреждение», «СПО», «ВО»
}

/* ── Анкета ── */
export interface ApplicantQuestionnaire {
  medal: string;            // «золотая», «серебряная», «—»
  olympicChampion: string;
  workYears: number;
  workMonths: number;
  specialtyYears: number;
  specialtyMonths: number;
  foreignLanguages: string;
  spoLevel: 'first' | 'second' | '';  // «впервые / повторно»
}

/* ── Дополнительно ── */
export interface ApplicantAdditional {
  receiptNumber: string;
  paidAmount: number;       // рубли
  paidMonths: number;
  bank: string;
  accountNumber: string;
  needsDormitory: boolean;
  educationForm: 'full_time' | 'part_time' | 'distance' | '';
  benefits: string;
  specialty: string;
  note: string;
}

/* ── Воинский учёт ── */
export interface ApplicantMilitary {
  status: 'liable' | 'reserve' | 'not_liable' | '';
  category: string;
  rank: string;
  commissariat: string;
}

/* ── Адрес проживания ── */
export interface ApplicantResidence {
  phone: string;
  address: string;
}

export interface ApplicantPayload {
  // студент
  photo: string | null;
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string;
  birthPlace: string;
  gender: 'M' | 'F';
  inn: string | null;
  snils: string;
  registrationNumber: string | null;
  caseNumber: string | null;

  // вкладки
  passport: ApplicantPassport;
  residence: ApplicantResidence;
  parents: ApplicantParent[];               // 0..2
  representative: ApplicantRepresentative | null;
  education: ApplicantEducation[];          // 0..N (обычно 1)
  questionnaire: ApplicantQuestionnaire | null;
  additional: ApplicantAdditional | null;
  military: ApplicantMilitary | null;
}

export class Applicant {
  constructor(
    public readonly id: string,
    public status: ApplicantStatus,
    public payload: ApplicantPayload,
    public readonly createdById: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}
