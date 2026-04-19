import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from '../../domain/services/password-hasher';

/**
 * Argon2id — современный алгоритм хеширования паролей (winner of PHC, 2015).
 * Параметры ниже — консервативный профиль для серверов общего назначения.
 * Соответствует требованиям 152-ФЗ: хранение паролей в необратимом виде.
 */
// `raw: false` обязательно в литеральной позиции — иначе TS не выбирает overload,
// возвращающий Promise<string> (он требует raw?: false | undefined, а не boolean).
type Argon2HashStringOpts = argon2.Options & { raw?: false };

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly opts: Argon2HashStringOpts = {
    type: argon2.argon2id,
    memoryCost: 19456, // ~19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.opts);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
