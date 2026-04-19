/**
 * Запись учебного плана: какая дисциплина в каком семестре и какой формой контроля.
 */
export type ControlForm = 'EXAM' | 'CREDIT' | 'DIFF_CREDIT' | 'COURSEWORK';

export class CurriculumEntry {
  constructor(
    public readonly id: string,
    public planId: string,            // FK → curriculum_plans.id
    public disciplineId: string,      // FK → disciplines.id
    public semester: number,          // 1-8 (для СПО — до 8)
    public controlForm: ControlForm,  // форма контроля
    public hours: number,             // часы по этой позиции плана
    public readonly createdAt: Date,
  ) {}
}
