import { IsDateString, IsEnum, IsOptional, IsString, Matches, IsUUID } from 'class-validator';

const PURPOSES = ['TUITION', 'DORM', 'FINE', 'OTHER'] as const;
const STATUSES = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;

export class CreatePaymentDto {
  @IsUUID() studentId!: string;
  @IsEnum(PURPOSES) purpose!: (typeof PURPOSES)[number];
  @Matches(/^\d+$/, { message: 'amountKopecks — целое число копеек (строка)' })
  amountKopecks!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsString() comment?: string;
}

export class ListPaymentsQueryDto {
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @IsEnum(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class MarkPaidDto {
  @IsOptional() @IsString() externalRef?: string;
}
