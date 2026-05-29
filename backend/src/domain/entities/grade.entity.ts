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
