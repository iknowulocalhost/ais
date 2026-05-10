import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Hostel, PassStatus } from '../../../domain/entities/pass.entity';

const HOSTELS: Hostel[] = ['NONE', 'H1', 'H2', 'H3'];
const STATUSES: PassStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export class SubmitPassDto {
  @IsString() @Length(1, 255) fullName!: string;
  @IsString() @Length(1, 100) groupOrPosition!: string;
  @IsIn(HOSTELS) hostel!: Hostel;
  @IsOptional() @IsString() @MaxLength(512) ticketKey?: string | null;
  @IsOptional() @IsString() @MaxLength(64) maxUserId?: string | null;
}

export class ListPassesQueryDto {
  @IsOptional() @IsIn(STATUSES) status?: PassStatus;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class InitPassTicketUploadDto {
  @IsString() @MaxLength(150) originalName!: string;
  @IsString() @MaxLength(64) contentType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50 * 1024 * 1024) sizeBytes!: number;
}

export class SetPassStatusDto {
  @IsEnum(['APPROVE', 'REJECT', 'RESET'] as const)
  decision!: 'APPROVE' | 'REJECT' | 'RESET';

  @ValidateIf((o: SetPassStatusDto) => o.decision === 'REJECT')
  @IsString()
  @Length(1, 500)
  comment?: string;

  @ValidateIf((o: SetPassStatusDto) => o.decision === 'APPROVE')
  @IsOptional()
  @IsString()
  @MaxLength(500)
  approveComment?: string;
}
