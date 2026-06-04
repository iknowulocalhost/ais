import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { BotSharedSecretGuard } from '../auth/bot-shared-secret.guard';
import { CreateMaxLinkTokenUseCase } from '../../../application/use-cases/max/create-max-link-token.use-case';
import { LinkMaxAccountUseCase } from '../../../application/use-cases/max/link-max-account.use-case';
import { UnlinkMaxAccountUseCase } from '../../../application/use-cases/max/unlink-max-account.use-case';
import { SkipMaxPromptUseCase } from '../../../application/use-cases/max/skip-max-prompt.use-case';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import { Inject } from '@nestjs/common';
import { AuditContext } from '../../../application/services/audit.service';

class LinkMaxDto {
  @IsString()
  @MinLength(32)
  @MaxLength(64)
  token!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  maxChatId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  maxFio?: string;
}

function buildCtx(req: Request, ip: string, actorId: string | null): AuditContext {
  return {
    actorId,
    ipAddress: ip ?? null,
    userAgent: (req.headers['user-agent'] as string) ?? null,
  };
}

@Controller('integrations/max')
export class MaxIntegrationController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly createTokenUC: CreateMaxLinkTokenUseCase,
    private readonly linkUC: LinkMaxAccountUseCase,
    private readonly unlinkUC: UnlinkMaxAccountUseCase,
    private readonly skipUC: SkipMaxPromptUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('link-token')
  @HttpCode(200)
  async createToken(
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    const ctx = buildCtx(req, ip, user.id);
    const res = await this.createTokenUC.execute(user.id, ctx);
    return {
      token: res.token,
      deepLink: res.deepLink,
      expiresAt: res.expiresAt.toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const u = await this.users.findById(user.id);
    const skip = u?.maxLinkPromptSkipCount ?? 0;
    return {
      linked: !!u?.maxChatId,
      skipCount: skip,
      // ≥2 → фронт обязан показать блок-модалку без кнопки «Позже».
      mustLink: !u?.maxChatId && skip >= 2,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('skip-prompt')
  @HttpCode(200)
  async skipPrompt(@CurrentUser() user: AuthenticatedUser) {
    return this.skipUC.execute(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('link')
  @HttpCode(204)
  async unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.unlinkUC.execute(user.id, buildCtx(req, ip, user.id));
  }

  // Вызывается ботом через docker-network; auth — shared secret.
  @Public()
  @UseGuards(BotSharedSecretGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('link')
  @HttpCode(200)
  async link(
    @Body() dto: LinkMaxDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    // actorId=null: инициатор — бот
    const ctx = buildCtx(req, ip, null);
    return this.linkUC.execute(dto.token, dto.maxChatId, dto.maxFio ?? null, ctx);
  }
}
