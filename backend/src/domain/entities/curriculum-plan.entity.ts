/**
 * Учебный план. Один план привязан к коду программы и году набора.
 * Состоит из записей CurriculumEntry (дисциплина + семестр + форма контроля).
 */
export type CurriculumPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export class CurriculumPlan {
  constructor(
    public readonly id: string,
    public programCode: string,         // код специальности, например «09.02.07»
    public admissionYear: number,       // год набора
    public name: string,                // «УП 09.02.07 набор 2024»
    public status: CurriculumPlanStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  activate(): void {
    if (this.status === 'ARCHIVED') {
      throw new Error('Нельзя активировать архивный план');
    }
    this.status = 'ACTIVE';
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = 'ARCHIVED';
    this.updatedAt = new Date();
  }
}
