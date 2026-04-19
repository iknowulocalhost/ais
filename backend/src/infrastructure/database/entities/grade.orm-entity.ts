import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'grades' })
@Index('ix_grades_sheet', ['sheetId'])
@Index('ix_grades_student', ['studentId'])
@Index('uq_grades_sheet_student', ['sheetId', 'studentId'], { unique: true })
export class GradeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sheet_id', type: 'uuid' })
  sheetId!: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({ type: 'int', nullable: true })
  value!: number | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
