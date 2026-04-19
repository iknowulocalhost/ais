import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MinLength(1)
  oldPassword!: string;

  @IsString() @MinLength(10)
  newPassword!: string;
}
