import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Grade Sheets ────────────────────────────────────────

const SHEET_STATUSES = ['OPEN', 'CLOSED'] as const;

export class CreateGradeSheetDto {
  @IsUUID()
  groupId!: string;

  @IsUUID()
  curriculumEntryId!: string;

  @IsDateString()
  date!: string;
}

export class ListGradeSheetsQueryDto {
  @IsOptional() @IsUUID()
  groupId?: string;

  @IsOptional() @IsUUID()
  teacherId?: string;

  @IsOptional() @IsEnum(SHEET_STATUSES)
  status?: (typeof SHEET_STATUSES)[number];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;
}

// ── Grades ──────────────────────────────────────────────

export class GradeInputDto {
  @IsUUID()
  gradeId!: string;

  @IsInt() @Min(0) @Max(5)
  value!: number;

  @IsOptional() @IsString()
  comment?: string;
}

export class SubmitGradesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradeInputDto)
  grades!: GradeInputDto[];
}
