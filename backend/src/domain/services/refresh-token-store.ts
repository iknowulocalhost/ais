/** Хранилище refresh-токенов: ключ `refresh:{userId}:{jti}`, TTL = JWT_REFRESH_TTL. */
export abstract class RefreshTokenStore {
  abstract save(userId: string, jti: string, tokenHash: string, ttlSeconds: number): Promise<void>;
  abstract exists(userId: string, jti: string, tokenHash: string): Promise<boolean>;
  abstract revoke(userId: string, jti: string): Promise<void>;
  abstract revokeAll(userId: string): Promise<void>;
}

export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');
