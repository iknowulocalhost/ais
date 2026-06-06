import { IsString, Length, MinLength } from 'class-validator';

// email = email или sAMAccountName (LDAP); поэтому не @IsEmail
export class LoginDto {
  @IsString()
  @Length(1, 320)
  email!: string;

  @IsString()
  @Length(1, 256)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
