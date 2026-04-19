import { Body, Controller, HttpCode, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginUseCase } from '../../../application/use-cases/auth/login.use-case';
import { RefreshUseCase } from '../../../application/use-cases/auth/refresh.use-case';
import { LogoutUseCase } from '../../../application/use-cases/auth/logout.use-case';
import { ChangePasswordUseCase } from '../../../application/use-cases/auth/change-password.use-case';
import { LoginDto, RefreshDto } from '../auth/dto/login.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { AuditContext } from '../../../application/services/audit.service';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

function buildCtx(req: Request, ip: string, actorId: string | null): AuditContext {
  return {
    actorId,
    ipAddress: ip ?? null,
    userAgent: (req.headers['user-agent'] as string) ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUC: LoginUseCase,
    private readonly refreshUC: RefreshUseCase,
    private readonly logoutUC: LogoutUseCase,
    private readonly changePwdUC: ChangePasswordUseCase,
  ) {}

  // Rate-limit: 10 попыток в минуту на IP (защита от брутфорса).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request) {
    return this.loginUC.execute(dto.email, dto.password, buildCtx(req, ip, null));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: Request) {
    return this.refreshUC.execute(dto.refreshToken, buildCtx(req, ip, null));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body() dto: Partial<RefreshDto>,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.logoutUC.execute(dto.refreshToken ?? null, user.id, buildCtx(req, ip, user.id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.changePwdUC.execute(user.id, dto.oldPassword, dto.newPassword, buildCtx(req, ip, user.id));
  }
}
