import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Ip,
  NotFoundException,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateUserDto } from '../dto/create-user.dto';
import { CreateUserUseCase } from '../../../application/use-cases/users/create-user.use-case';
import { AuditContext } from '../../../application/services/audit.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import { User } from '../../../domain/entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  @Roles(Role.ADM)
  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    const ctx: AuditContext = {
      actorId: actor.id,
      ipAddress: ip ?? null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
    };
    const user = await this.createUser.execute(
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName ?? null,
        roles: dto.roles,
      },
      ctx,
    );
    return this.serialize(user);
  }

  /**
   * Актуальный профиль для UI. JWT содержит только id/email/roles;
   * ФИО и активность подтягиваем из БД — это одна точечная выборка по индексу.
   */
  @Get('me')
  async me(@CurrentUser() actor: AuthenticatedUser) {
    const u = await this.users.findById(actor.id);
    if (!u) throw new NotFoundException();
    return this.serialize(u);
  }

  @Roles(Role.ADM, Role.ANA)
  @Get()
  async list(@Query('limit') limit = '50', @Query('offset') offset = '0') {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    const { items, total } = await this.users.list(lim, off);
    return { total, items: items.map((u) => this.serialize(u)) };
  }

  private serialize(u: User) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      middleName: u.middleName,
      roles: u.roles,
      isActive: u.isActive,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    };
  }
}
