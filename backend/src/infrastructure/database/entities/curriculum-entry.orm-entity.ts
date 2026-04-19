import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ControlForm } from '../../../domain/entities/curriculum-entry.entity';

@Entity({ name: 'curriculum_entries' })
@Index('ix_curriculum_entries_plan', ['planId'])
@Index('uq_curriculum_entries_plan_disc_sem', ['planId', 'disciplineId', 'semester'], { unique: true })
export class CurriculumEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'discipline_id', type: 'uuid' })
  disciplineId!: string;

  @Column({ type: 'int' })
  semester!: number;

  @Column({ name: 'control_form', type: 'varchar', length: 16 })
  controlForm!: ControlForm;

  @Column({ type: 'int' })
  hours!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
