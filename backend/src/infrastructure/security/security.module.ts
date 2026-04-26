import { Global, Module } from '@nestjs/common';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { ApplicantCipherService } from './applicant-cipher.service';
import { PASSWORD_HASHER } from '../../domain/services/password-hasher';

@Global()
@Module({
  providers: [
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    ApplicantCipherService,
  ],
  exports: [PASSWORD_HASHER, ApplicantCipherService],
})
export class SecurityModule {}
