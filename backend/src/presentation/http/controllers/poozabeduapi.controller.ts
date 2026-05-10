import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import { SyncPoozabeduUseCase } from '../../../application/use-cases/poozabedu/sync-poozabedu.use-case';
import { GetStudentDetailUseCase } from '../../../application/use-cases/poozabedu/get-student-detail.use-case';
import { GetCollegeGpaUseCase } from '../../../application/use-cases/poozabedu/get-college-gpa.use-case';
import { GetJournalUseCase } from '../../../application/use-cases/poozabedu/get-journal.use-case';
import { GetScheduleUseCase } from '../../../application/use-cases/poozabedu/get-schedule.use-case';
import { ListEmployeesUseCase } from '../../../application/use-cases/poozabedu/list-employees.use-case';
import { GetReportUseCase } from '../../../application/use-cases/poozabedu/get-report.use-case';
import {
  POOZABEDU_DEPARTMENT_REPOSITORY,
  POOZABEDU_STUDENT_GROUP_REPOSITORY,
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduDepartmentRepository,
  PoozabeduStudentGroupRepository,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';

class ListMirrorStudentsDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() groupExternalId?: number;
  @IsOptional() @IsBooleanString() isActive?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

const STAFF_FULL: Role[] = [Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM];
const STAFF_AND_TEACHER: Role[] = [...STAFF_FULL, Role.TEA];

/**
 * Эндпоинты интеграции с Сетевым ПОО.
 *
 * RBAC по уровням доступа:
 *  - **STU** — нет доступа ни к одному эндпоинту (студент свои оценки/расписание
 *    смотрит только в Сетевом ПОО, в АИС у него только заявки/пропуска).
 *  - **TEA** (классный руководитель) — видит **только** свои группы, их журналы
 *    и студентов. Привязка делается по `users.netschool_employee_id` ↔
 *    `poozabedu_student_group.curator_external_id`. Если у TEA-аккаунта поле
 *    `netschool_employee_id` не задано — fail-closed, не видит ничего.
 *  - **COM** — учебная часть. Видит всех студентов и все группы.
 *  - **ADM / SUPERADMIN** — полный доступ.
 *
 * Реализация ограничения для TEA: всегда выясняем список разрешённых
 * `groupExternalIds` через `groupRepo.listOwnedExternalIdsByCurator(...)` и
 * либо фильтруем выдачу, либо отказываем по 403.
 */
@Controller('poozabeduapi')
export class PoozabeduApiController {
  constructor(
    private readonly client: PoozabeduApiClient,
    private readonly syncUc: SyncPoozabeduUseCase,
    private readonly detailUc: GetStudentDetailUseCase,
    private readonly collegeGpaUc: GetCollegeGpaUseCase,
    private readonly journalUc: GetJournalUseCase,
    private readonly scheduleUc: GetScheduleUseCase,
    private readonly employeesUc: ListEmployeesUseCase,
    private readonly reportUc: GetReportUseCase,
    @Inject(POOZABEDU_DEPARTMENT_REPOSITORY)
    private readonly deptRepo: PoozabeduDepartmentRepository,
    @Inject(POOZABEDU_STUDENT_GROUP_REPOSITORY)
    private readonly groupRepo: PoozabeduStudentGroupRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly studentRepo: PoozabeduStudentRepository,
  ) {}

  @Roles(Role.SUPERADMIN)
  @Get('ping')
  async ping() {
    const result = await this.client.ping();
    return {
      ok: true,
      organization: {
        id: result.organization.organizationId,
        deptId: result.organization.organizationDeptId,
        name: result.organization.name,
        shortName: result.organization.shortName,
        abbreviation: result.organization.abbreviation,
        type: result.organization.type,
        organizationType: result.organization.organizationType,
        director: result.organization.directorName,
        phone: result.organization.phone,
        email: result.organization.email,
      },
      statistics: result.statistics,
      systemInfo: result.systemInfo,
    };
  }

  /** Триггер полной синхронизации справочников. Тяжёлая (~30s). Только SUPERADMIN. */
  @Roles(Role.SUPERADMIN)
  @Post('sync')
  async sync() {
    const report = await this.syncUc.execute();
    return { ok: true, report };
  }

  /**
   * Список сотрудников для админских форм (например, привязка TEA-аккаунта
   * к конкретному классному руководителю в Сетевом ПОО). Не аудитируется —
   * это справочник без ПДн.
   */
  @Roles(Role.ADM, Role.SUPERADMIN)
  @Get('employees')
  async listEmployees() {
    return this.employeesUc.execute();
  }

  // ────────── зеркало (наша БД) ──────────

  @Roles(...STAFF_FULL)
  @Get('mirror/departments')
  async listDepartments() {
    const items = await this.deptRepo.listAll();
    return items.map((d) => ({
      externalId: d.externalId,
      name: d.name,
      isActive: d.isActive,
      syncedAt: d.syncedAt,
    }));
  }

  /**
   * Список групп. Полный для STAFF, ограниченный для TEA. Поле `educationForm`
   * помогает фронту разделять очников/заочников.
   */
  @Roles(...STAFF_AND_TEACHER)
  @Get('mirror/groups')
  async listGroups(@CurrentUser() user: AuthenticatedUser | null) {
    const items = await this.groupRepo.listAll();
    const allowed = await this.allowedGroupIds(user);
    const filtered = allowed === 'all' ? items : items.filter((g) => allowed.has(g.externalId));
    return filtered.map((g) => ({
      externalId: g.externalId,
      name: g.name,
      code: g.code,
      yearNumber: g.yearNumber,
      educationForm: g.educationForm,
      departmentExternalId: g.departmentExternalId,
      curatorExternalId: g.curatorExternalId,
      isActive: g.isActive,
      syncedAt: g.syncedAt,
    }));
  }

  @Roles(...STAFF_AND_TEACHER)
  @Get('mirror/students')
  async listStudents(
    @Query() q: ListMirrorStudentsDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const isActive = q.isActive === undefined ? true : q.isActive === 'true';
    const allowed = await this.allowedGroupIds(user);

    // Если TEA пытается фильтровать по конкретной группе — она должна быть «своей».
    if (allowed !== 'all' && q.groupExternalId !== undefined && !allowed.has(q.groupExternalId)) {
      throw new ForbiddenException('Эта группа не закреплена за вами');
    }

    const res = await this.studentRepo.list(
      {
        search: q.search,
        groupExternalId: q.groupExternalId,
        isActive,
        groupExternalIdsAllowed: allowed === 'all' ? undefined : Array.from(allowed),
      },
      q.limit ?? 100,
      q.offset ?? 0,
    );
    return {
      total: res.total,
      items: res.items.map((s) => ({
        externalId: s.externalId,
        lastName: s.lastName,
        firstName: s.firstName,
        middleName: s.middleName,
        birthDate: s.birthDate,
        gender: s.gender,
        groupExternalId: s.groupExternalId,
        groupName: s.groupName,
        educationBasis: s.educationBasis,
        gradePointAverage: s.gradePointAverage,
        isActive: s.isActive,
      })),
    };
  }

  // ────────── on-demand из Сетевого ПОО ──────────

  /**
   * Полная карточка с ПДн (паспорт/адрес/СНИЛС/родители).
   * Для TEA: только если студент в одной из его групп. Это первый по логике
   * чувствительный эндпоинт — должны быть особенно строги.
   */
  @Roles(...STAFF_AND_TEACHER)
  @Get('students/:externalId')
  async getStudentDetail(
    @Param('externalId', ParseIntPipe) externalId: number,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    await this.assertStudentVisible(externalId, user);
    return this.detailUc.execute(externalId);
  }

  /**
   * Средний балл студента в техникуме — по реальным отметкам в журнале.
   * Намеренно отдельный эндпоинт, потому что считается на лету и тяжелее
   * остальных полей карточки. UI грузит лениво, после основной части досье.
   */
  @Roles(...STAFF_AND_TEACHER)
  @Get('students/:externalId/college-gpa')
  async getStudentCollegeGpa(
    @Param('externalId', ParseIntPipe) externalId: number,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    await this.assertStudentVisible(externalId, user);
    return this.collegeGpaUc.execute(externalId);
  }

  // ────────── журнал (on-demand proxy) ──────────

  @Roles(...STAFF_AND_TEACHER)
  @Get('journal/groups')
  async listJournalGroups(@CurrentUser() user: AuthenticatedUser | null) {
    const upstream = await this.journalUc.listGroups();
    const allowed = await this.allowedGroupIds(user);
    if (allowed === 'all') return upstream;
    return upstream.filter((g) => allowed.has(g.id));
  }

  @Roles(...STAFF_AND_TEACHER)
  @Get('journal/groups/:groupExternalId/entries')
  async listJournalGroupEntries(
    @Param('groupExternalId', ParseIntPipe) groupExternalId: number,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    await this.assertGroupVisible(groupExternalId, user);
    return this.journalUc.listGroupEntries(groupExternalId);
  }

  /**
   * Журнал по предмету. Для TEA — обязательная проверка, что `gradebookId`
   * принадлежит одной из его групп. STAFF получает без ограничений.
   */
  @Roles(...STAFF_AND_TEACHER)
  @Get('journal/gradebooks/:gradebookId/subjects/:subjectId')
  async getJournalSubject(
    @Param('gradebookId', ParseIntPipe) gradebookId: number,
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    const constraints =
      user && !isStaffFull(user) && user.netschoolEmployeeId
        ? { allowedCuratorEmployeeId: user.netschoolEmployeeId }
        : undefined;
    return this.journalUc.getSubject(gradebookId, subjectId, constraints);
  }

  // ────────── расписание (on-demand proxy) ──────────

  @Roles(...STAFF_AND_TEACHER)
  @Get('schedule/teachers')
  async listScheduleTeachers() {
    return this.scheduleUc.listTeachers();
  }

  @Roles(...STAFF_AND_TEACHER)
  @Get('schedule/classrooms')
  async listScheduleClassrooms() {
    return this.scheduleUc.listClassrooms();
  }

  @Roles(...STAFF_AND_TEACHER)
  @Get('schedule/groups/:groupExternalId/entries')
  async getScheduleGroupEntries(
    @Param('groupExternalId', ParseIntPipe) groupExternalId: number,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    await this.assertGroupVisible(groupExternalId, user);
    return this.scheduleUc.getGroupEntries(groupExternalId);
  }

  @Roles(...STAFF_AND_TEACHER)
  @Get('schedule/timetable')
  async getScheduleTimetable(
    @Query('from') dateFrom: string,
    @Query('to') dateTo: string,
    @Query('type') type: 'studentGroup' | 'teacher',
    @Query('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw new BadRequestException('from/to ожидаются в формате yyyy-mm-dd');
    }
    if (type !== 'studentGroup' && type !== 'teacher') {
      throw new BadRequestException("type ожидается 'studentGroup' или 'teacher'");
    }
    // TEA может смотреть только СВОЁ расписание как преподавателя
    // (id совпадает с netschoolEmployeeId учётки). Чужой учитель — отказ.
    // STAFF — без ограничений.
    if (!isStaffFull(user) && type === 'teacher') {
      if (!user?.netschoolEmployeeId || user.netschoolEmployeeId !== id) {
        throw new ForbiddenException('Расписание чужого преподавателя недоступно');
      }
    }
    return this.scheduleUc.getTimetable(dateFrom, dateTo, type, id);
  }

  // ────────── Отчёты Сетевого ПОО ──────────

  /**
   * Универсальный прокси к `/services/reports/*`. Путь после `/reports/`
   * передаётся параметром `path`. Дополнительные query-параметры (departmentId,
   * specialtyId и т.п.) автоматически прокидываются в upstream — кроме самого `path`.
   *
   * Примеры путей: `years`, `years/2025/terms`, `group/1873/students`,
   * `curator/group-attestation/1873`.
   */
  @Roles(...STAFF_AND_TEACHER)
  @Get('reports')
  async getReport(
    @Query('path') path: string,
    @Query() rawQuery: Record<string, unknown>,
  ) {
    if (typeof path !== 'string' || !path) {
      throw new BadRequestException('Не указан путь отчёта');
    }
    const query: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      if (k === 'path') continue;
      if (typeof v === 'string' || typeof v === 'number') query[k] = v;
    }
    return this.reportUc.execute(path, query);
  }

  // ────────── helpers ──────────

  /**
   * Возвращает множество externalId групп, видимых пользователю.
   * `'all'` — без ограничений (STAFF). `Set<number>` — конкретный список (TEA).
   * Пустой Set означает «нет ни одной группы» (TEA без привязки) — эндпоинты
   * вернут пустые списки или 403.
   */
  private async allowedGroupIds(user: AuthenticatedUser | null): Promise<'all' | Set<number>> {
    if (!user) return new Set();
    if (isStaffFull(user)) return 'all';
    if (user.roles.includes(Role.TEA)) {
      if (!user.netschoolEmployeeId) return new Set();
      const ids = await this.groupRepo.listOwnedExternalIdsByCurator(user.netschoolEmployeeId);
      return new Set(ids);
    }
    return new Set();
  }

  private async assertGroupVisible(
    groupExternalId: number,
    user: AuthenticatedUser | null,
  ): Promise<void> {
    const allowed = await this.allowedGroupIds(user);
    if (allowed === 'all') return;
    if (!allowed.has(groupExternalId)) {
      throw new ForbiddenException('Эта группа не закреплена за вами');
    }
  }

  private async assertStudentVisible(
    studentExternalId: number,
    user: AuthenticatedUser | null,
  ): Promise<void> {
    const allowed = await this.allowedGroupIds(user);
    if (allowed === 'all') return;
    const student = await this.studentRepo.findByExternalId(studentExternalId);
    if (!student) throw new ForbiddenException('Студент не найден или вне вашего доступа');
    if (student.groupExternalId === null || !allowed.has(student.groupExternalId)) {
      throw new ForbiddenException('Студент не из вашей группы');
    }
  }
}

function isStaffFull(user: AuthenticatedUser | null): boolean {
  return !!user?.roles.some((r) => (STAFF_FULL as string[]).includes(r));
}
