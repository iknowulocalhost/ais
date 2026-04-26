import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ── nested ── */

export class PassportDto {
  @IsString() @Matches(/^\d{4}$/, { message: 'Серия — 4 цифры' }) series!: string;
  @IsString() @Matches(/^\d{6}$/, { message: 'Номер — 6 цифр' }) number!: string;
  @IsString() @Length(1, 200) issuedBy!: string;
  @IsDateString() issuedDate!: string;
  @IsString() @Matches(/^\d{3}-\d{3}$/, { message: 'Код подразделения — 000-000' }) divisionCode!: string;
  @IsOptional() @IsString() @MaxLength(64) citizenship?: string;
  @IsOptional() @IsString() @MaxLength(500) registrationAddress?: string;
}

export class ResidenceDto {
  @IsOptional() @IsString() @MaxLength(64) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
}

export class ParentDto {
  @IsIn(['mother', 'father', 'guardian', 'other']) kind!: 'mother' | 'father' | 'guardian' | 'other';
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(200) work?: string;
  @IsOptional() @IsString() @MaxLength(64) phone?: string;
}

export class RepresentativePassportDto {
  @IsOptional() @IsString() @MaxLength(16) series?: string;
  @IsOptional() @IsString() @MaxLength(16) number?: string;
  @IsOptional() @IsString() @MaxLength(200) issuedBy?: string;
  @IsOptional() @IsDateString() issuedDate?: string;
}

export class RepresentativeDto {
  @IsIn(['student', 'parent1', 'parent2', 'custom']) source!: 'student' | 'parent1' | 'parent2' | 'custom';
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @ValidateNested() @Type(() => RepresentativePassportDto) passport?: RepresentativePassportDto;
}

export class EducationDto {
  @IsOptional() @IsString() @MaxLength(300) institution?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) graduationYear?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) averageGrade?: number;
  @IsOptional() @IsString() @MaxLength(64) documentType?: string;
  @IsOptional() @IsString() @MaxLength(32) documentSeries?: string;
  @IsOptional() @IsString() @MaxLength(64) documentNumber?: string;
  @IsOptional() @IsDateString() documentIssueDate?: string;
  @IsOptional() @IsString() @MaxLength(128) institutionType?: string;
}

export class QuestionnaireDto {
  @IsOptional() @IsString() @MaxLength(64)  medal?: string;
  @IsOptional() @IsString() @MaxLength(255) olympicChampion?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(80) workYears?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(11) workMonths?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(80) specialtyYears?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(11) specialtyMonths?: number;
  @IsOptional() @IsString() @MaxLength(255) foreignLanguages?: string;
  @IsOptional() @IsIn(['first', 'second', '']) spoLevel?: 'first' | 'second' | '';
}

export class AdditionalDto {
  @IsOptional() @IsString() @MaxLength(64)  receiptNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) paidAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt()    @Min(0) @Max(120) paidMonths?: number;
  @IsOptional() @IsString() @MaxLength(128) bank?: string;
  @IsOptional() @IsString() @MaxLength(64)  accountNumber?: string;
  @IsOptional() @IsBoolean()                needsDormitory?: boolean;
  @IsOptional() @IsIn(['full_time', 'part_time', 'distance', '']) educationForm?: 'full_time' | 'part_time' | 'distance' | '';
  @IsOptional() @IsString() @MaxLength(128) benefits?: string;
  @IsOptional() @IsString() @MaxLength(128) specialty?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class MilitaryDto {
  @IsOptional() @IsIn(['liable', 'reserve', 'not_liable', '']) status?: 'liable' | 'reserve' | 'not_liable' | '';
  @IsOptional() @IsString() @MaxLength(8)   category?: string;
  @IsOptional() @IsString() @MaxLength(64)  rank?: string;
  @IsOptional() @IsString() @MaxLength(200) commissariat?: string;
}

/* ── корневой DTO ── */

export class CreateApplicantDto {
  @IsOptional() @IsString() @MaxLength(8 * 1024 * 1024) photo?: string | null;

  @IsString() @Length(1, 100) lastName!: string;
  @IsString() @Length(1, 100) firstName!: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string | null;

  @IsDateString() birthDate!: string;
  @IsString() @Length(1, 200) birthPlace!: string;
  @IsIn(['M', 'F']) gender!: 'M' | 'F';

  @IsOptional() @IsString() @Matches(/^\d{12}$|^$/, { message: 'ИНН — 12 цифр' }) inn?: string | null;
  @IsString() @Matches(/^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'СНИЛС — 000-000-000 00' }) snils!: string;
  @IsOptional() @IsString() @MaxLength(32) registrationNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(32) caseNumber?: string | null;

  @ValidateNested() @Type(() => PassportDto) passport!: PassportDto;

  @IsOptional() @ValidateNested() @Type(() => ResidenceDto) residence?: ResidenceDto;

  @IsOptional() @IsArray() @ArrayMaxSize(2)
  @ValidateNested({ each: true }) @Type(() => ParentDto)
  parents?: ParentDto[];

  @IsOptional() @ValidateNested() @Type(() => RepresentativeDto) representative?: RepresentativeDto;

  @IsOptional() @IsArray() @ArrayMaxSize(5)
  @ValidateNested({ each: true }) @Type(() => EducationDto)
  education?: EducationDto[];

  @IsOptional() @ValidateNested() @Type(() => QuestionnaireDto) questionnaire?: QuestionnaireDto;
  @IsOptional() @ValidateNested() @Type(() => AdditionalDto)    additional?: AdditionalDto;
  @IsOptional() @ValidateNested() @Type(() => MilitaryDto)      military?: MilitaryDto;

  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED']) status?: 'DRAFT' | 'SUBMITTED';
}

export class ListApplicantsQueryDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'ENROLLED', 'REJECTED']) status?:
    | 'DRAFT' | 'SUBMITTED' | 'ENROLLED' | 'REJECTED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}
