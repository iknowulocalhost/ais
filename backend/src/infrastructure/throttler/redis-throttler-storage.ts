import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
// ThrottlerStorageRecord не реэкспортируется из корня в v5 — импортируем напрямую.
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.module';

/**
 * Реализация ThrottlerStorage на Redis: распределённый rate-limit
 * (корректно работает при горизонтальном масштабировании backend).
 *
 * API v5: increment(key, ttl) → { totalHits, timeToExpire }.
 * Лимит/блокировка обрабатываются самим ThrottlerGuard на основании totalHits.
 */
@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${key}`;
    const pipe = this.redis.multi();
    pipe.incr(redisKey);
    pipe.pttl(redisKey);
    const results = (await pipe.exec()) as [Error | null, number | string][];
    const totalHits = Number(results[0][1]);
    let timeToExpire = Number(results[1][1]);

    if (totalHits === 1 || timeToExpire < 0) {
      await this.redis.pexpire(redisKey, ttl);
      timeToExpire = ttl;
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpire / 1000),
    };
  }
}
