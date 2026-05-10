import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { SubmitPassUseCase } from '../../../application/use-cases/passes/submit-pass.use-case';
import { ListPassesUseCase } from '../../../application/use-cases/passes/list-passes.use-case';
import { SetPassStatusUseCase } from '../../../application/use-cases/passes/set-pass-status.use-case';
import { InitPassTicketUploadUseCase } from '../../../application/use-cases/passes/init-pass-ticket-upload.use-case';
import { DeletePassTicketUseCase } from '../../../application/use-cases/passes/delete-pass-ticket.use-case';
import {
  BUCKETS,
  OBJECT_STORAGE,
  ObjectStorage,
} from '../../../domain/services/object-storage';
import {
  InitPassTicketUploadDto,
  ListPassesQueryDto,
  SetPassStatusDto,
  SubmitPassDto,
} from '../dto/pass.dto';
import {
  PASS_REPOSITORY,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import { Pass } from '../../../domain/entities/pass.entity';

/**
 * Сотрудничьи роли — видят чужие заявки и могут менять статус. Учитель (TEA) попадает
 * сюда: он оформляет пропуска и справки на студентов своей группы.
 */
const STAFF_ROLES: Role[] = [Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA];

function isStaff(user: AuthenticatedUser | null): boolean {
  return !!user?.roles.some((r) => (STAFF_ROLES as string[]).includes(r));
}

@Controller('passes')
export class PassesController {
  constructor(
    private readonly submitUc: SubmitPassUseCase,
    private readonly listUc: ListPassesUseCase,
    private readonly statusUc: SetPassStatusUseCase,
    private readonly initUploadUc: InitPassTicketUploadUseCase,
    private readonly deleteTicketUc: DeletePassTicketUseCase,
    @Inject(PASS_REPOSITORY) private readonly passes: PassRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /** Подача заявки. STU создаёт от своего имени; STAFF — на любого студента. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Post()
  async create(@Body() dto: SubmitPassDto) {
    const saved = await this.submitUc.execute(dto);
    return { id: saved.id, status: saved.status };
  }

  /**
   * Список заявок. STU видит только свои; STAFF — все. Фильтрация делается на бэке,
   * чтобы STU физически не мог получить чужие записи через query-parameters.
   */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get()
  async list(
    @Query() q: ListPassesQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const res = await this.listUc.execute(
      {
        status: q.status,
        search: q.search,
        createdFrom: q.createdFrom,
        createdTo: q.createdTo,
        submitterUserId: isStaff(user) ? undefined : user?.id,
      },
      q.limit ?? 50,
      q.offset ?? 0,
    );
    return { total: res.total, items: res.items.map((p) => this.serialize(p)) };
  }

  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const p = await this.passes.findById(id);
    if (!p) throw new NotFoundException();
    this.assertCanAccess(p, user);
    return this.serialize(p);
  }

  /**
   * Загрузка квитанции студентом (или сотрудником).
   * STU — только своя заявка и только пока в PENDING.
   * STAFF — любая заявка, любой статус.
   */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Post(':id/ticket-upload')
  async initTicketUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitPassTicketUploadDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const p = await this.passes.findById(id);
    if (!p) throw new NotFoundException();
    this.assertCanAccess(p, user);

    return this.initUploadUc.execute({
      passId: id,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      originalName: dto.originalName,
      bypassStatusCheck: isStaff(user),
    });
  }

  /** Удаление квитанции у заявки — только сотрудник. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM)
  @Delete(':id/ticket')
  async deleteTicket(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteTicketUc.execute(id);
    return { ok: true };
  }

  /** Presigned GET URL для просмотра квитанции — STU тоже может посмотреть свою. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get(':id/ticket-url')
  async ticketUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const p = await this.passes.findById(id);
    if (!p) throw new NotFoundException();
    this.assertCanAccess(p, user);
    if (!p.ticketKey) {
      return { url: null, ttlSeconds: 0 };
    }
    const url = await this.storage.getPresignedGetUrl(BUCKETS.PASSES, p.ticketKey, 900);
    return { url, ttlSeconds: 900 };
  }

  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM)
  @Post(':id/status')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPassStatusDto,
  ) {
    const comment =
      dto.decision === 'REJECT' ? dto.comment ?? null : dto.approveComment ?? null;
    await this.statusUc.execute({ passId: id, decision: dto.decision, comment });
    return { ok: true };
  }

  private assertCanAccess(p: Pass, user: AuthenticatedUser | null): void {
    if (!user) throw new BadRequestException('Неаутентифицирован');
    if (isStaff(user)) return;
    if (p.submitterUserId !== user.id) {
      throw new ForbiddenException('Нет доступа к этой заявке');
    }
  }

  private serialize(p: Pass) {
    return {
      id: p.id,
      fullName: p.fullName,
      groupOrPosition: p.groupOrPosition,
      hostel: p.hostel,
      ticketKey: p.ticketKey,
      maxUserId: p.maxUserId,
      submitterUserId: p.submitterUserId,
      status: p.status,
      statusComment: p.statusComment,
      reviewerId: p.reviewerId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
