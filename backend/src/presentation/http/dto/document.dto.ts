import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

const KINDS = ['PASSPORT', 'SNILS', 'EDU_CERTIFICATE', 'MEDICAL', 'PHOTO', 'OTHER'] as const;
type Kind = (typeof KINDS)[number];

export class InitDocumentUploadDto {
  @IsEnum(KINDS) kind!: Kind;
  @IsString() @Length(1, 255) originalName!: string;
  @IsString() @Length(1, 127) contentType!: string;
  @IsInt() @Min(1) @Max(25 * 1024 * 1024) sizeBytes!: number;
}

export class VerifyDocumentDto {
  @IsEnum(['APPROVE', 'REJECT']) outcome!: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
}
