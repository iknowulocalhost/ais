import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.module';
import { ThrottlerStorageRedisService } from './redis-throttler-storage';

/**
 * @nestjs/throttler v5 не поддерживает extraProviders в forRootAsync.
 * Решение: инжектим REDIS_CLIENT напрямую (RedisModule глобальный) и инстанциируем
 * storage прямо в фабрике. Это эквивалентно выносу его из DI-контейнера, что ок
 * для stateless-сервиса — хранилище не имеет состояния сверх redis-клиента.
 */
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (_cfg: ConfigService, redis: Redis) => ({
        // Дефолтный лимит (перекрывается через @Throttle на эндпоинтах).
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule {}
