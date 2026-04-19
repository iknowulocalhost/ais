import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CurriculumPlanStatus } from '../../../domain/entities/curriculum-plan.entity';

@Entity({ name: 'curriculum_plans' })
@Index('ix_curriculum_plans_program_year', ['programCode', 'admissionYear'])
@Index('ix_curriculum_plans_status', ['status'])
export class CurriculumPlanOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'program_code', type: 'varchar', length: 32 })
  programCode!: string;

  @Column({ name: 'admission_year', type: 'int' })
  admissionYear!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status!: CurriculumPlanStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
