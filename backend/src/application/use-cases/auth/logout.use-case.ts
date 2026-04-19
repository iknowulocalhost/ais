import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  REFRESH_TOKEN_STORE,
  RefreshTokenStore,
} from '../../../domain/services/refresh-token-store';
import { AuditService, AuditContext } from '../../services/audit.service';
import { JwtRefreshPayload } from './login.use-case';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshStore: RefreshTokenStore,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async execute(refreshToken: string | null, actorId: string, ctx: AuditContext): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<JwtRefreshPayload>(refreshToken, {
          secret: this.cfg.getOrThrow<string>('JWT_REFRESH_SECRET'),
        });
        await this.refreshStore.revoke(payload.sub, payload.jti);
      } catch {
        // токен кривой — тихо игнорируем, всё равно запишем LOGOUT
      }
    }

    await this.audit.record({
      ctx,
      action: 'LOGOUT',
      entity: 'User',
      entityId: actorId,
    });
  }
}
