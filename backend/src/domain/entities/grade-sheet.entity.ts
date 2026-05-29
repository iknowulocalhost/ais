export type GradeSheetStatus = 'OPEN' | 'CLOSED';

export class GradeSheet {
  constructor(
    public readonly id: string,
    public groupId: string,              // FK → groups.id
    public curriculumEntryId: string,    // FK → curriculum_entries.id (дисциплина+семестр+контроль)
    public teacherId: string,            // FK → users.id (TEA)
    public date: Date,                   // дата проведения
    public status: GradeSheetStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  close(): void {
    if (this.status === 'CLOSED') return;
    this.status = 'CLOSED';
    this.updatedAt = new Date();
  }

  reopen(): void {
    this.status = 'OPEN';
    this.updatedAt = new Date();
  }
}
