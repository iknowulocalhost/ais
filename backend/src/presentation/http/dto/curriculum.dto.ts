import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

// ── Disciplines ─────────────────────────────────────────

export class CreateDisciplineDto {
  @IsString() @Length(1, 32)
  code!: string;

  @IsString() @Length(1, 255)
  name!: string;

  @IsInt() @Min(1)
  totalHours!: number;
}

export class ListDisciplinesQueryDto {
  @IsOptional() @IsString()
  search?: string;
}

// ── Curriculum Plans ────────────────────────────────────

const PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

export class CreateCurriculumPlanDto {
  @IsString() @Length(1, 32)
  programCode!: string;

  @IsInt() @Min(2000) @Max(2100)
  admissionYear!: number;

  @IsString() @Length(1, 255)
  name!: string;
}

export class ListCurriculumPlansQueryDto {
  @IsOptional() @IsString()
  programCode?: string;

  @IsOptional() @IsInt()
  admissionYear?: number;

  @IsOptional() @IsEnum(PLAN_STATUSES)
  status?: (typeof PLAN_STATUSES)[number];
}

// ── Curriculum Entries ──────────────────────────────────

const CONTROL_FORMS = ['EXAM', 'CREDIT', 'DIFF_CREDIT', 'COURSEWORK'] as const;

export class AddCurriculumEntryDto {
  @IsUUID()
  disciplineId!: string;

  @IsInt() @Min(1) @Max(8)
  semester!: number;

  @IsEnum(CONTROL_FORMS)
  controlForm!: (typeof CONTROL_FORMS)[number];

  @IsInt() @Min(1)
  hours!: number;
}
