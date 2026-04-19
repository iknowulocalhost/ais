export type StudentStatus =
  | 'APPLICANT'    // абитуриент (COM ещё ведёт)
  | 'ENROLLED'     // зачислен
  | 'ACADEMIC_LEAVE' // академический отпуск
  | 'EXPELLED'     // отчислен
  | 'GRADUATED';   // выпущен

/**
 * Студент. Связан с User (учётка для входа) опциональной FK.
 * Абитуриент (APPLICANT) может существовать без User — его заводит приёмная комиссия.
 */
export class Student {
  constructor(
    public readonly id: string,
    public userId: string | null,      // null пока нет учётной записи
    public groupId: string | null,
    public firstName: string,
    public lastName: string,
    public middleName: string | null,
    public birthDate: Date,
    public status: StudentStatus,
    public avatarObjectKey: string | null, // ключ объекта в MinIO
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  enroll(groupId: string): void {
    this.groupId = groupId;
    this.status = 'ENROLLED';
    this.updatedAt = new Date();
  }

  expel(): void {
    this.status = 'EXPELLED';
    this.updatedAt = new Date();
  }
}
