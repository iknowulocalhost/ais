/**
 * DTO ответов «Сетевого ПОО» (poo.zabedu.ru).
 * Намеренно мягкие: IRTech добавляют/убирают поля в патч-релизах.
 */

export interface OrganizationInfo {
  organizationId: string;          // UUID
  rosobrId?: string;               // UUID Рособрнадзора
  organizationDeptId?: number;     // 1, 2, …
  name?: string;
  shortName?: string;
  abbreviation?: string;
  organizationType?: string;       // 'Spo' и т.п.
  type?: string;                   // 'Poo' и т.п.
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
  // …прочее, что IRTech добавит — приходит через index signature
  [key: string]: unknown;
}

export interface OrganizationStatistics {
  [key: string]: unknown;          // структура пока не известна — увидим на ping
}

export interface SystemInfo {
  [key: string]: unknown;          // версии, build, язык
}

/**
 * Сотрудник школы. Возвращает `/services/people/employees/all` —
 * лёгкий список без ПДн (для дропдаунов, привязки TEA-аккаунтов).
 */
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

// ─────── Сущности (минимально-необходимый набор полей) ───────

export interface PzaShortGroupRef {
  id: number;
  name: string;
}

/** Подразделение учебного заведения (отделение). */
export interface PzaDepartment {
  id: number;
  name: string;
  managerId?: number;
}

/** Учебная группа. */
export interface PzaStudentGroup {
  id: number;
  name: string;
  code?: string;
  yearNumber?: number;             // курс 1..N
  educationForm?: string;          // 'FullTime' | …
  departmentId?: number;
  curatorId?: number;              // id сотрудника-куратора
}

/**
 * Студент в формате list-эндпоинта `/services/people/students`.
 * Намеренно НЕ описываем passport/address/snils/parents — эти поля приходят только
 * на детальном эндпоинте `/students/{id}`, а копировать их к нам в БД мы не хотим
 * (152-ФЗ: принцип минимизации).
 */
export interface PzaStudentSummary {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  birthday?: string;               // ISO строка с микросекундами от IRTech
  gender?: 'Male' | 'Female' | string;
  studentGroup?: PzaShortGroupRef;
  userProfileId?: number;
  educationBasis?: string;         // 'FederalBudget' | 'NaturalPerson' | …
  educationLevel?: string;
  formOfTraining?: string;
  graduationDate?: string;
  gradePointAverage?: number;
  isEsiaBound?: boolean;
}

/** Ответ list-эндпоинта студентов с серверной пагинацией. */
export interface PzaStudentsPage {
  studentsCount: number;
  students: PzaStudentSummary[];
}

/**
 * Полная карточка студента — отдаётся `/services/people/students/{id}`.
 * Содержит ПДн (паспорт, адреса, СНИЛС, родители) — НИКОГДА не сохраняем в БД,
 * только проксируем на запрос авторизованного оператора. Поля описаны мягко.
 */
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
    relationshipType?: string;     // 'Mother' | 'Father' | …
    phone?: string;
    address?: string;
    [k: string]: unknown;
  }>;
  decrees?: Array<{
    id: number;
    type?: string;                 // 'Enroll' | 'Expel' | …
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

/** Группа в перечне доступных журналов: `/services/journal/gradebook/student-groups`. */
export interface PzaGradebookGroup {
  id: number;          // groupId
  name: string;
  code?: string;
  yearNumber?: number;
}

/** Предмет в учебном плане группы за конкретный семестр. */
export interface PzaScheduleSubject {
  id: number;                      // gradebookId этого предмета (нужен для /subjects/{id})
  name: string;
  plannedHours?: number;
  editable?: boolean;
  isAttendanceEditable?: boolean;
  remarks?: unknown[];
}

/** Один семестр группы — приходит в `/gradebook/{groupId}/entries`. */
export interface PzaGradebookEntry {
  id: number;                       // gradebookId самого журнала-семестра
  name: string;                     // обычно совпадает с именем группы
  yearNumber: number;
  termNumber: number;
  termType: string;                 // 'Semester' | …
  isActive: boolean;
  startDate: string;
  endDate: string;
  scheduleSubjects: PzaScheduleSubject[];
}

/** Конкретный урок и оценки/посещаемость учеников по нему. */
export interface PzaGradebookLesson {
  id: number;
  date: string;
  scheduleLessonId?: number;
  type: string;                     // 'Lecture' | 'PracticalWork' | 'PracticalTraining' | 'Examination' | …
  duration?: number;
  startTime?: string;
  endTime?: string;
  tasks?: Array<{
    id: number;
    type?: string;                  // 'Home' | …
    topic?: string;
    condition?: string;
    attachments?: unknown[];
  }>;
  /**
   * Карта оценок и пропусков по этому уроку.
   * Ключ — id студента в gradebook (см. `students[].id`), не глобальный externalId.
   */
  markSets?: Record<string, {
    absenceType?: string;           // 'IsAbsentByNotValidReason' | 'IsAbsentByValidReason' | 'IsLate' | …
    marks?: Record<string, unknown>; // конкретный формат оценки — увидим в живом ответе
  }>;
  plannedLessons?: Record<string, number>;
}

/** Записанный в журнал ученик группы (id здесь — internal к gradebook). */
export interface PzaGradebookStudent {
  id: number;
  number?: number;                  // позиция в журнале
  startDate?: string;
  endDate?: string;
  averageScore?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}

/** Полный ответ `/gradebook/{gradebookId}/subjects/{subjectId}`. */
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
  teacher?: string;                 // 'Каргин П.А.' (в виде строки, не объекта)
}

// ─────── Расписание ───────
//
// Тела соответствующих ответов IRTech не были захвачены HAR-ом (Brave стрипает крупные
// JSON), поэтому пока описано мягко. Уточним типы после первого живого вызова через
// наш прокси и обновим, не ломая обратной совместимости.

export type PzaScheduleTeachers = unknown;
export type PzaScheduleClassrooms = unknown;

export interface PzaScheduleGroupEntries {
  // Из URL `/services/schedule/timetable/{groupId}/entries` известно, что это список
  // «планов расписания» у группы, по которым потом тянется недельный grid с диапазоном дат.
  [key: string]: unknown;
}

/**
 * Расписание за период. Вход: `from`, `to` в формате `yyyy-mm-dd`,
 * `type` — обычно `studentGroup`, `id` — id плана/группы из upstream.
 */
export type PzaScheduleTimetable = unknown;
