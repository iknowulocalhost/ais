import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { SubmitCertificateUseCase } from '../../../application/use-cases/certificates/submit-certificate.use-case';
import { ListCertificatesUseCase } from '../../../application/use-cases/certificates/list-certificates.use-case';
import { SetCertificateStatusUseCase } from '../../../application/use-cases/certificates/set-certificate-status.use-case';
import { UpdateCertificateDativeUseCase } from '../../../application/use-cases/certificates/update-certificate-dative.use-case';
import {
  ListCertificatesQueryDto,
  SetCertificateStatusDto,
  SubmitCertificateDto,
  UpdateCertificateDativeDto,
} from '../dto/certificate.dto';
import {
  CERTIFICATE_REQUEST_REPOSITORY,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import { CertificateRequest } from '../../../domain/entities/certificate-request.entity';

/**
 * Сотрудничьи роли — видят чужие заявки. TEA включён сюда, чтобы классный
 * руководитель мог оформлять справки на студентов своей группы.
 */
const STAFF_ROLES: Role[] = [Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA];

function isStaff(user: AuthenticatedUser | null): boolean {
  return !!user?.roles.some((r) => (STAFF_ROLES as string[]).includes(r));
}

@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly submitUc: SubmitCertificateUseCase,
    private readonly listUc: ListCertificatesUseCase,
    private readonly statusUc: SetCertificateStatusUseCase,
    private readonly dativeUc: UpdateCertificateDativeUseCase,
    @Inject(CERTIFICATE_REQUEST_REPOSITORY)
    private readonly certs: CertificateRequestRepository,
  ) {}

  /** Подача заявки. STU создаёт от своего имени, STAFF — от любого. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Post()
  async create(@Body() dto: SubmitCertificateDto) {
    const saved = await this.submitUc.execute(dto);
    return { id: saved.id, status: saved.status, displayNo: saved.displayNo };
  }

  /** Список. STU — только свои; STAFF — все. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get()
  async list(
    @Query() q: ListCertificatesQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const res = await this.listUc.execute(
      {
        status: q.status,
        certType: q.certType,
        search: q.search,
        createdFrom: q.createdFrom,
        createdTo: q.createdTo,
        submitterUserId: isStaff(user) ? undefined : user?.id,
      },
      q.limit ?? 50,
      q.offset ?? 0,
    );
    return { total: res.total, items: res.items.map((c) => this.serialize(c)) };
  }

  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM, Role.TEA, Role.STU)
  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const c = await this.certs.findById(id);
    if (!c) throw new NotFoundException();
    this.assertCanAccess(c, user);
    return this.serialize(c);
  }

  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM)
  @Post(':id/status')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCertificateStatusDto,
  ) {
    const comment =
      dto.decision === 'REJECT' ? dto.comment ?? null : dto.approveComment ?? null;
    await this.statusUc.execute({ certificateId: id, decision: dto.decision, comment });
    return { ok: true };
  }

  /**
   * Ручная коррекция ФИО в дательном падеже на карточке справки.
   * Передать строку — установить точное значение; передать `null` — пересчитать
   * через petrovich заново.
   */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM)
  @Patch(':id/dative-name')
  async updateDative(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateDativeDto,
  ) {
    return this.dativeUc.execute({
      certificateId: id,
      fullNameDat: dto.fullNameDat,
    });
  }

  private assertCanAccess(c: CertificateRequest, user: AuthenticatedUser | null): void {
    if (!user) throw new BadRequestException('Неаутентифицирован');
    if (isStaff(user)) return;
    if (c.submitterUserId !== user.id) {
      throw new ForbiddenException('Нет доступа к этой заявке');
    }
  }

  private serialize(c: CertificateRequest) {
    return {
      id: c.id,
      displayNo: c.displayNo,
      certType: c.certType,
      fullName: c.fullName,
      fullNameDat: c.fullNameDat,
      birthDate: c.birthDate,
      groupName: c.groupName,
      targetOrg: c.targetOrg,
      phone: c.phone,
      email: c.email,
      comment: c.comment,
      periodFrom: c.periodFrom,
      periodTo: c.periodTo,
      status: c.status,
      statusComment: c.statusComment,
      reviewerId: c.reviewerId,
      maxUserId: c.maxUserId,
      submitterUserId: c.submitterUserId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
