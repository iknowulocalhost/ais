import { createHash } from 'crypto';

/** Хэш пароля для POST /services/security/login: base64(sha256(plain)). */
export function buildLoginPasswordHash(plainPassword: string): string {
  return createHash('sha256').update(plainPassword, 'utf8').digest('base64');
}
