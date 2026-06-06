import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class BotSharedSecretGuard implements CanActivate {
  constructor(private readonly cfg: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = this.cfg.get<string>('MAX_BOT_AIS_SHARED_SECRET', '');
    if (!expected) throw new UnauthorizedException('Bot shared secret не настроен');

    const got = (req.headers['x-ais-token'] as string | undefined) ?? '';
    if (!got || got.length !== expected.length) {
      throw new UnauthorizedException('Неверный bot-secret');
    }
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Неверный bot-secret');
    }
    return true;
  }
}
