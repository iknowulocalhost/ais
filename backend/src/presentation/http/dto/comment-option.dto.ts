import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateCommentOptionDto {
  @IsString() @Length(1, 100) title!: string;
  @IsString() @Length(1, 255) text!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
