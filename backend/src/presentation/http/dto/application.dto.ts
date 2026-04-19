import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ApplicationStatus } from '../../../domain/entities/application.entity';

const STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'ENROLLED',
];

export class SubmitApplicationDto {
  @IsString() @Length(1, 100) firstName!: string;
  @IsString() @Length(1, 100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string | null;
  @IsDateString() birthDate!: string;
  @IsEmail() @MaxLength(320) email!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
  @IsString() @Length(1, 32) programCode!: string;
}

export class ListApplicationsQueryDto {
  @IsOptional() @IsIn(STATUSES) status?: ApplicationStatus;
  @IsOptional() @IsString() @MaxLength(32) programCode?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class ReviewApplicationDto {
  @IsEnum(['TAKE', 'ACCEPT', 'REJECT'] as const)
  decision!: 'TAKE' | 'ACCEPT' | 'REJECT';

  @ValidateIf((o: ReviewApplicationDto) => o.decision === 'REJECT')
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class BatchEnrollDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  applicationIds!: string[];

  @IsString() @Length(1, 64) groupId!: string;
}
