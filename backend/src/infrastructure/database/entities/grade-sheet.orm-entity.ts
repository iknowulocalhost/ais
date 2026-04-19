import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GradeSheetStatus } from '../../../domain/entities/grade-sheet.entity';

@Entity({ name: 'grade_sheets' })
@Index('ix_grade_sheets_group', ['groupId'])
@Index('ix_grade_sheets_teacher', ['teacherId'])
@Index('ix_grade_sheets_entry', ['curriculumEntryId'])
export class GradeSheetOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'curriculum_entry_id', type: 'uuid' })
  curriculumEntryId!: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Column({ type: 'date' })
  date!: Date;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status!: GradeSheetStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
