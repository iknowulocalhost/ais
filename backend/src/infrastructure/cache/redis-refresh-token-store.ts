import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { RefreshTokenStore } from '../../domain/services/refresh-token-store';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }

  // Доп. слой: в Redis хранится sha-256(token), не сам токен.
  private digest(tokenHash: string): string {
    return createHash('sha256').update(tokenHash).digest('hex');
  }

  async save(userId: string, jti: string, tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(userId, jti), this.digest(tokenHash), 'EX', ttlSeconds);
  }

  async exists(userId: string, jti: string, tokenHash: string): Promise<boolean> {
    const stored = await this.redis.get(this.key(userId, jti));
    return stored !== null && stored === this.digest(tokenHash);
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.redis.del(this.key(userId, jti));
  }

  async revokeAll(userId: string): Promise<void> {
    const pattern = `refresh:${userId}:*`;
    const stream = this.redis.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if ((keys as string[]).length) {
        await this.redis.del(...(keys as string[]));
      }
    }
  }
}
