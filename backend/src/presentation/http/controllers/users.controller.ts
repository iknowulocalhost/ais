import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import { CreateUserDto } from '../dto/create-user.dto';
import { CreateUserUseCase } from '../../../application/use-cases/users/create-user.use-case';
import { SetUserNetschoolEmployeeUseCase } from '../../../application/use-cases/users/set-netschool-employee.use-case';
import { SetUserRolesUseCase } from '../../../application/use-cases/users/set-user-roles.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/users/reset-password.use-case';
import { EnsureStudentAccountUseCase } from '../../../application/use-cases/users/ensure-student-account.use-case';
import { BulkEnsureGroupAccountsUseCase } from '../../../application/use-cases/users/bulk-ensure-group-accounts.use-case';
import { ParseIntPipe } from '@nestjs/common';
import { AuditContext } from '../../../application/services/audit.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../../domain/repositories/audit-log.repository';
import { User } from '../../../domain/entities/user.entity';

class SetNetschoolEmployeeDto {
  @ValidateIf((o: SetNetschoolEmployeeDto) => o.netschoolEmployeeId !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  netschoolEmployeeId!: number | null;
}

class SetUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly setNetschoolEmployee: SetUserNetschoolEmployeeUseCase,
    private readonly setUserRoles: SetUserRolesUseCase,
    private readonly resetPasswordUc: ResetPasswordUseCase,
    private readonly ensureStudentAccountUc: EnsureStudentAccountUseCase,
    private readonly bulkEnsureGroupAccountsUc: BulkEnsureGroupAccountsUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogs: AuditLogRepository,
  ) {}

  @Roles(Role.ADM, Role.SUPERADMIN)
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

  @Roles(Role.ADM, Role.SUPERADMIN, Role.ADMINISTRATION)
  @Get()
  async list(@Query('limit') limit = '50', @Query('offset') offset = '0') {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);
    const { items, total } = await this.users.list(lim, off);
    return { total, items: items.map((u) => this.serialize(u)) };
  }

  /** Карточка пользователя — для админ-формы. */
  @Roles(Role.ADM, Role.SUPERADMIN)
  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException();
    return this.serialize(u);
  }

  /**
   * Привязка пользователя АИС к сотруднику Сетевого ПОО.
   * Используется для выдачи TEA-доступа к его группам.
   * Передать `null` — снять привязку.
   */
  @Roles(Role.ADM, Role.SUPERADMIN)
  @Patch(':id/netschool-employee')
  async patchNetschoolEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetNetschoolEmployeeDto,
  ) {
    return this.setNetschoolEmployee.execute(id, dto.netschoolEmployeeId);
  }

  /**
   * Изменить набор ролей пользователя. После сохранения — перелогин (роли в JWT).
   * Подъём до SUPERADMIN — только из-под действующего SUPERADMIN; снятие SUPERADMIN
   * с самого себя запрещено.
   */
  @Roles(Role.ADM, Role.SUPERADMIN)
  @Patch(':id/roles')
  async patchRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.setUserRoles.execute(id, dto.roles, { id: actor.id, roles: actor.roles });
  }

  /**
   * Сброс пароля пользователю. Возвращает новый plaintext-пароль ровно один раз —
   * админ показывает/печатает его и сохраняет (мы хеш не храним в обратимом виде).
   */
  @Roles(Role.ADM, Role.SUPERADMIN)
  @Post(':id/reset-password')
  @HttpCode(200)
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.resetPasswordUc.execute(id);
  }

  /**
   * Создать (или вернуть существующий) студенческий аккаунт по external_id из
   * зеркала Сетевого ПОО. Идемпотентно: если уже создавали — вернёт ту же
   * учётку, но без пароля. Свежесозданному выдаём plaintext-пароль один раз.
   */
  @Roles(Role.ADM, Role.SUPERADMIN, Role.COM)
  @Post('students/:externalId/account')
  @HttpCode(200)
  async ensureStudentAccount(
    @Param('externalId', ParseIntPipe) externalId: number,
  ) {
    return this.ensureStudentAccountUc.execute(externalId);
  }

  /** Найти учётку, привязанную к студенту из зеркала. 404 если ещё не создана. */
  @Roles(Role.ADM, Role.SUPERADMIN, Role.COM)
  @Get('students/:externalId/account')
  async getStudentAccount(
    @Param('externalId', ParseIntPipe) externalId: number,
  ) {
    const u = await this.users.findByStudentExternalId(externalId);
    if (!u) throw new NotFoundException('Аккаунт не создан');
    return this.serialize(u);
  }

  /**
   * История смен пароля по аккаунту. Берём из `audit_log` записи с
   * `entity='User'`, `action='PASSWORD_CHANGE'` для нужного userId — там же
   * сохраняется кто именно сбросил пароль (`actorId`).
   */
  @Roles(Role.ADM, Role.SUPERADMIN, Role.COM)
  @Get(':id/password-history')
  async passwordHistory(@Param('id', ParseUUIDPipe) id: string) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException();
    const logs = await this.auditLogs.findByEntity('User', id, 50);
    const passwordEvents = logs.filter((l) => l.action === 'PASSWORD_CHANGE');
    // Подсасываем ФИО актёров за один проход — чтобы фронт сразу нарисовал
    // «сбросил Иванов И.И.», без второго запроса.
    const actorIds = [...new Set(passwordEvents.map((e) => e.actorId).filter((x): x is string => !!x))];
    const actorNameById = new Map<string, string>();
    for (const aid of actorIds) {
      const a = await this.users.findById(aid).catch(() => null);
      if (a) {
        const initial = a.firstName ? `${a.firstName[0]}.` : '';
        const mid = a.middleName ? `${a.middleName[0]}.` : '';
        actorNameById.set(aid, `${a.lastName} ${initial}${mid ? ' ' + mid : ''}`.trim());
      }
    }
    return {
      lastLoginAt: u.lastLoginAt,
      events: passwordEvents.map((e) => ({
        ts: e.ts,
        actorId: e.actorId,
        actorName: e.actorId ? (actorNameById.get(e.actorId) ?? null) : null,
        ipAddress: e.ipAddress,
        selfReset: e.actorId === id,
      })),
    };
  }

  /**
   * Массовое создание студенческих аккаунтов целой группы. Идемпотентно:
   * существующие учётки остаются как есть, новым выдаются пароли. Возвращает
   * сводный список — годится для распечатки и раздачи.
   */
  @Roles(Role.ADM, Role.SUPERADMIN, Role.COM)
  @Post('groups/:externalId/accounts')
  @HttpCode(200)
  async bulkEnsureGroupAccounts(
    @Param('externalId', ParseIntPipe) externalId: number,
  ) {
    return { items: await this.bulkEnsureGroupAccountsUc.execute(externalId) };
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
      netschoolEmployeeId: u.netschoolEmployeeId,
      studentExternalId: u.studentExternalId,
    };
  }
}
