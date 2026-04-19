import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case';
import { RefreshUseCase } from '../../application/use-cases/auth/refresh.use-case';
import { LogoutUseCase } from '../../application/use-cases/auth/logout.use-case';
import { ChangePasswordUseCase } from '../../application/use-cases/auth/change-password.use-case';
import { AuditService } from '../../application/services/audit.service';
import { RedisRefreshTokenStore } from '../../infrastructure/cache/redis-refresh-token-store';
import { REFRESH_TOKEN_STORE } from '../../domain/services/refresh-token-store';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Секреты задаются per-call в use-cases (access/refresh — разные).
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    ChangePasswordUseCase,
    AuditService,
    RedisRefreshTokenStore,
    { provide: REFRESH_TOKEN_STORE, useExisting: RedisRefreshTokenStore },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
