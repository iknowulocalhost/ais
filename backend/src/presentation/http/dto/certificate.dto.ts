import {
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
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  CertificateStatus,
  CertificateType,
} from '../../../domain/entities/certificate-request.entity';

const TYPES: CertificateType[] = ['STUDY', 'SCHOLARSHIP', 'INCOME', 'TAX', 'MILITARY'];
const STATUSES: CertificateStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export class SubmitCertificateDto {
  @IsIn(TYPES) certType!: CertificateType;
  @IsString() @Length(1, 255) fullName!: string;
  @IsDateString() birthDate!: string;
  @IsString() @Length(1, 50) groupName!: string;
  @IsString() @Length(1, 255) targetOrg!: string;
  @IsString() @Length(1, 32) phone!: string;
  @IsEmail() @MaxLength(320) email!: string;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string | null;
  @IsOptional() @IsDateString() periodFrom?: string | null;
  @IsOptional() @IsDateString() periodTo?: string | null;
  @IsOptional() @IsString() @MaxLength(64) maxUserId?: string | null;
}

export class ListCertificatesQueryDto {
  @IsOptional() @IsIn(STATUSES) status?: CertificateStatus;
  @IsOptional() @IsIn(TYPES) certType?: CertificateType;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  /** Фильтр по дате создания (ISO yyyy-mm-dd). Включительно с обеих сторон. */
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class UpdateCertificateDativeDto {
  /** `null` — сбросить к авто-значению (пересчёт petrovich). Иначе — ровно введённое. */
  @ValidateIf((o: UpdateCertificateDativeDto) => o.fullNameDat !== null)
  @IsString()
  @MaxLength(300)
  fullNameDat!: string | null;
}

export class SetCertificateStatusDto {
  @IsEnum(['APPROVE', 'REJECT', 'RESET'] as const)
  decision!: 'APPROVE' | 'REJECT' | 'RESET';

  @ValidateIf((o: SetCertificateStatusDto) => o.decision === 'REJECT')
  @IsString()
  @Length(1, 500)
  comment?: string;

  @ValidateIf((o: SetCertificateStatusDto) => o.decision === 'APPROVE')
  @IsOptional()
  @IsString()
  @MaxLength(500)
  approveComment?: string;
}
