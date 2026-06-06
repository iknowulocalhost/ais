/** DTO Сетевого ПОО (poo.zabedu.ru). Поля мягкие — IRTech правят их в патч-релизах. */

export interface OrganizationInfo {
  organizationId: string;
  rosobrId?: string;
  organizationDeptId?: number;
  name?: string;
  shortName?: string;
  abbreviation?: string;
  organizationType?: string;
  type?: string;
  legalStatus?: string;
  directorName?: string;
  directorPosition?: string;
  email?: string;
  phone?: string;
  site?: string;
  address?: {
    region?: string;
    settlement?: string;
    mailAddress?: string;
    kladr?: string;
  };
  bankingDetails?: {
    inn?: string;
    kpp?: string;
    ogrn?: string;
    oktmo?: string;
    okpo?: string;
    [k: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OrganizationStatistics {
  [key: string]: unknown;
}

export interface SystemInfo {
  [key: string]: unknown;
}

/** Сотрудник (/services/people/employees/all). */
export interface PzaEmployee {
  id: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  positionId?: number;
  positionName?: string;
  isFired?: boolean;
  [key: string]: unknown;
}

// ─────── Сущности ───────

export interface PzaShortGroupRef {
  id: number;
  name: string;
}

export interface PzaDepartment {
  id: number;
  name: string;
  managerId?: number;
}

export interface PzaStudentGroup {
  id: number;
  name: string;
  code?: string;
  yearNumber?: number;
  educationForm?: string;
  departmentId?: number;
  curatorId?: number;
}

/** Студент в листинге /services/people/students (без ПДн). */
export interface PzaStudentSummary {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  birthday?: string;
  gender?: 'Male' | 'Female' | string;
  studentGroup?: PzaShortGroupRef;
  userProfileId?: number;
  educationBasis?: string;
  educationLevel?: string;
  formOfTraining?: string;
  graduationDate?: string;
  gradePointAverage?: number;
  isEsiaBound?: boolean;
}

export interface PzaStudentsPage {
  studentsCount: number;
  students: PzaStudentSummary[];
}

/** Полная карточка студента — /students/{id}. Содержит ПДн, в БД не сохраняем. */
export interface PzaStudentDetail extends PzaStudentSummary {
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
  parents?: Array<{
    id: number;
    userProfileId?: number;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    relationshipType?: string;
    phone?: string;
    address?: string;
    [k: string]: unknown;
  }>;
  decrees?: Array<{
    id: number;
    type?: string;
    date?: string;
    effectiveDate?: string;
    studentGroup?: PzaShortGroupRef;
    number?: string;
    [k: string]: unknown;
  }>;
  documents?: unknown[];
  [k: string]: unknown;
}

// ─────── Журнал / оценки ───────

export interface PzaGradebookGroup {
  id: number;
  name: string;
  code?: string;
  yearNumber?: number;
}

export interface PzaScheduleSubject {
  id: number;
  name: string;
  plannedHours?: number;
  editable?: boolean;
  isAttendanceEditable?: boolean;
  remarks?: unknown[];
}

export interface PzaGradebookEntry {
  id: number;
  name: string;
  yearNumber: number;
  termNumber: number;
  termType: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  scheduleSubjects: PzaScheduleSubject[];
}

export interface PzaGradebookLesson {
  id: number;
  date: string;
  scheduleLessonId?: number;
  type: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  tasks?: Array<{
    id: number;
    type?: string;
    topic?: string;
    condition?: string;
    attachments?: unknown[];
  }>;
  /** Ключ — id студента в gradebook (не глобальный externalId). */
  markSets?: Record<string, {
    absenceType?: string;
    marks?: Record<string, unknown>;
  }>;
  plannedLessons?: Record<string, number>;
}

export interface PzaGradebookStudent {
  id: number;
  number?: number;
  startDate?: string;
  endDate?: string;
  averageScore?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}

export interface PzaGradebookSubject {
  workingProgram?: {
    isApproved?: boolean;
    topics?: Array<{
      sectionIndex?: number;
      index?: number;
      name?: string;
      lessons?: Array<{
        id: number;
        type?: string;
        duration?: number;
        name?: string;
      }>;
    }>;
  };
  lessons: PzaGradebookLesson[];
  students: PzaGradebookStudent[];
  remarks?: unknown[];
  teacher?: string;
}

// ─────── Расписание ───────

export type PzaScheduleTeachers = unknown;
export type PzaScheduleClassrooms = unknown;

export interface PzaScheduleGroupEntries {
  [key: string]: unknown;
}

export type PzaScheduleTimetable = unknown;
