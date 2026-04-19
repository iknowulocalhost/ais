/**
 * Оценка студента в ведомости.
 *
 * Числовая шкала:
 *   5 = отлично, 4 = хорошо, 3 = удовлетворительно, 2 = неудовлетворительно.
 * Для зачёта без оценки (CREDIT):
 *   value = 1 (зачтено) или 0 (не зачтено).
 *
 * Оценку можно менять, пока ведомость OPEN.
 */
export class Grade {
  constructor(
    public readonly id: string,
    public sheetId: string,           // FK → grade_sheets.id
    public studentId: string,         // FK → students.id
    public value: number | null,      // null = ещё не выставлена
    public comment: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  setValue(val: number, comment: string | null): void {
    this.value = val;
    this.comment = comment;
    this.updatedAt = new Date();
  }
}
