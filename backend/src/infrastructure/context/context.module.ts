import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContext } from './request-context';
import { ContextMiddleware } from './context.middleware';
import { ActorInterceptor } from './actor.interceptor';

@Global()
@Module({
  providers: [
    RequestContext,
    { provide: APP_INTERCEPTOR, useClass: ActorInterceptor },
  ],
  exports: [RequestContext],
})
export class ContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
