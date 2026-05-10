import { Global, Module } from '@nestjs/common';
import { PoozabeduApiClient } from './poozabeduapi.client';

/**
 * Глобально доступный клиент Сетевого Города. Делаем `@Global()` потому,
 * что разными use-case'ами (sync-students, sync-grades, …) клиент будет шарить
 * одну и ту же in-process очередь сессий — иначе sessions limit на стороне IRTech.
 */
@Global()
@Module({
  providers: [PoozabeduApiClient],
  exports: [PoozabeduApiClient],
})
export class PoozabeduApiModule {}
