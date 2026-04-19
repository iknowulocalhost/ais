import { Global, Module } from '@nestjs/common';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PASSWORD_HASHER } from '../../domain/services/password-hasher';

@Global()
@Module({
  providers: [
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
  ],
  exports: [PASSWORD_HASHER],
})
export class SecurityModule {}
