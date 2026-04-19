import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

const STATUSES = ['APPLICANT', 'ENROLLED', 'ACADEMIC_LEAVE', 'EXPELLED', 'GRADUATED'] as const;
type StudentStatusLiteral = (typeof STATUSES)[number];

export class CreateStudentDto {
  @IsString() @Length(1, 100)
  firstName!: string;

  @IsString() @Length(1, 100)
  lastName!: string;

  @IsOptional() @IsString() @Length(1, 100)
  middleName?: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional() @IsEnum(STATUSES)
  status?: StudentStatusLiteral;

  @IsOptional() @IsUUID()
  groupId?: string;

  @IsOptional() @IsUUID()
  userId?: string;
}

export class ListStudentsQueryDto {
  @IsOptional() @IsEnum(STATUSES)
  status?: StudentStatusLiteral;

  @IsOptional() @IsUUID()
  groupId?: string;

  @IsOptional() @IsString()
  search?: string;
}
