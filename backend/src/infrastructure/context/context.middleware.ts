import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContext) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    // actorId подставит AuthContextInterceptor после JwtAuthGuard (JWT уже распарсен).
    this.ctx.run(
      { actorId: null, ipAddress: ip, userAgent: (req.headers['user-agent'] as string) ?? null },
      () => next(),
    );
  }
}
