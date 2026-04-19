/**
 * Порт для хеширования паролей.
 * Требование 152-ФЗ: пароли не хранятся в открытом виде.
 * Реализация в infrastructure/security (Argon2id).
 */
export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract verify(hash: string, plain: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
