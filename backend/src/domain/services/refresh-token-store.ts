/**
 * Порт хранилища refresh-токенов.
 * Реализация — Redis (infrastructure/cache).
 *
 * Модель: храним хеш refresh-токена под ключом `refresh:{userId}:{jti}`
 * с TTL = JWT_REFRESH_TTL. Это позволяет:
 *   - отзывать отдельную сессию (logout с jti),
 *   - отзывать все сессии пользователя (logout all — удалить ключи по паттерну),
 *   - детектировать reuse украденного токена (отсутствие jti → compromise).
 */
export abstract class RefreshTokenStore {
  abstract save(userId: string, jti: string, tokenHash: string, ttlSeconds: number): Promise<void>;
  abstract exists(userId: string, jti: string, tokenHash: string): Promise<boolean>;
  abstract revoke(userId: string, jti: string): Promise<void>;
  abstract revokeAll(userId: string): Promise<void>;
}

export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');
