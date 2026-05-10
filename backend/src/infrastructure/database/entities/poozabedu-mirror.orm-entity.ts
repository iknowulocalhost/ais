import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'poozabedu_department' })
export class PoozabeduDepartmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ux_pza_dept_external_id', { unique: true })
  @Column({ name: 'external_id', type: 'integer' })
  externalId!: number;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'manager_external_id', type: 'integer', nullable: true })
  managerExternalId!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'poozabedu_student_group' })
export class PoozabeduStudentGroupOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ux_pza_group_external_id', { unique: true })
  @Column({ name: 'external_id', type: 'integer' })
  externalId!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  code!: string | null;

  @Column({ name: 'year_number', type: 'integer', nullable: true })
  yearNumber!: number | null;

  @Column({ name: 'education_form', type: 'varchar', length: 32, nullable: true })
  educationForm!: string | null;

  @Column({ name: 'department_external_id', type: 'integer', nullable: true })
  departmentExternalId!: number | null;

  @Column({ name: 'curator_external_id', type: 'integer', nullable: true })
  curatorExternalId!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'poozabedu_student' })
@Index('ix_pza_student_group', ['groupExternalId'])
@Index('ix_pza_student_active', ['isActive'])
export class PoozabeduStudentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ux_pza_student_external_id', { unique: true })
  @Column({ name: 'external_id', type: 'integer' })
  externalId!: number;

  @Column({ name: 'last_name', type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ name: 'middle_name', type: 'varchar', length: 120, nullable: true })
  middleName!: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gender!: string | null;

  @Column({ name: 'group_external_id', type: 'integer', nullable: true })
  groupExternalId!: number | null;

  @Column({ name: 'group_name', type: 'varchar', length: 100, nullable: true })
  groupName!: string | null;

  @Column({ name: 'education_basis', type: 'varchar', length: 32, nullable: true })
  educationBasis!: string | null;

  @Column({ name: 'grade_point_average', type: 'numeric', precision: 4, scale: 2, nullable: true })
  gradePointAverage!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
