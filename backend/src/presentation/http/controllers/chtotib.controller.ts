import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { ChtotibParserService } from '../../../infrastructure/external/chtotib/chtotib-parser.service';
import {
  GetTodayScheduleUseCase,
  assertCanViewGroup,
} from '../../../application/use-cases/chtotib/get-today-schedule.use-case';
import { GetWeekScheduleUseCase } from '../../../application/use-cases/chtotib/get-week-schedule.use-case';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  POOZABEDU_STUDENT_REPOSITORY,
  POOZABEDU_STUDENT_GROUP_REPOSITORY,
  PoozabeduStudentRepository,
  PoozabeduStudentGroupRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';

/** /chtotib/* — расписание/замены с публичных страниц chtotib.ru. */
@Controller('chtotib')
export class ChtotibController {
  constructor(
    private readonly parser: ChtotibParserService,
    private readonly todayUc: GetTodayScheduleUseCase,
    private readonly weekUc: GetWeekScheduleUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    @Inject(POOZABEDU_STUDENT_GROUP_REPOSITORY)
    private readonly groups: PoozabeduStudentGroupRepository,
  ) {}

  /** GET /chtotib/today — расписание на сегодня по ролям пользователя. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA, Role.STU)
  @Get('today')
  async today(@CurrentUser() user: AuthenticatedUser) {
    return this.todayUc.execute(user);
  }

  /** Список доступных групп — для админских списков и фильтров. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA)
  @Get('groups')
  async listGroups() {
    return { items: await this.parser.listGroups() };
  }

  /** Список преподавателей. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA)
  @Get('teachers')
  async listTeachers() {
    return { items: await this.parser.listTeachers() };
  }

  /** Расписание конкретной группы по имени. RBAC внутри. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA, Role.STU)
  @Get('group')
  async groupSchedule(
    @Query('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!name || name.length < 2) throw new BadRequestException('name обязателен');
    await assertCanViewGroup(
      user,
      name,
      async () => {
        const u = await this.users.findById(user.id);
        if (!u?.studentExternalId) return null;
        const s = await this.students.findByExternalId(u.studentExternalId);
        return s?.groupName ?? null;
      },
      async () => {
        if (!user.netschoolEmployeeId) return [];
        const ids = await this.groups.listOwnedExternalIdsByCurator(
          user.netschoolEmployeeId,
        );
        const all = await this.groups.listAll();
        return all.filter((g) => ids.includes(g.externalId)).map((g) => g.name);
      },
    );
    const lessons = await this.parser.getGroupSchedule(name);
    return { groupName: name, lessons };
  }

  /** Расписание преподавателя по имени. Доступно STAFF, остальные через /today. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA)
  @Get('teacher')
  async teacherSchedule(@Query('name') name: string) {
    if (!name || name.length < 2) throw new BadRequestException('name обязателен');
    const lessons = await this.parser.getTeacherSchedule(name);
    return { teacherName: name, lessons };
  }

  /** Метаданные снимка (дата и время скачивания) — для отображения шапки. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA, Role.STU)
  @Get('snapshot')
  async snapshot() {
    return this.parser.getSnapshot();
  }

  /* ───────── недельное расписание ───────── */

  /** Персональная недельная сетка по ролям (STU → группа, TEA → группа + личное). */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA, Role.STU)
  @Get('week')
  async week(@CurrentUser() user: AuthenticatedUser) {
    return this.weekUc.execute(user);
  }

  /** Недельная сетка конкретной группы. RBAC: STU — только своя; TEA — только своя. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA, Role.STU)
  @Get('week/group')
  async weekGroup(
    @Query('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!name || name.length < 2) throw new BadRequestException('name обязателен');
    await assertCanViewGroup(
      user,
      name,
      async () => {
        const u = await this.users.findById(user.id);
        if (!u?.studentExternalId) return null;
        const s = await this.students.findByExternalId(u.studentExternalId);
        return s?.groupName ?? null;
      },
      async () => {
        if (!user.netschoolEmployeeId) return [];
        const ids = await this.groups.listOwnedExternalIdsByCurator(
          user.netschoolEmployeeId,
        );
        const all = await this.groups.listAll();
        return all.filter((g) => ids.includes(g.externalId)).map((g) => g.name);
      },
    );
    const week = await this.parser.getWeekForGroup(name);
    return week ?? { target: name, kind: 'group', days: [] };
  }

  /** Недельная сетка конкретного преподавателя. STAFF — без ограничений. */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA)
  @Get('week/teacher')
  async weekTeacher(@Query('name') name: string) {
    if (!name || name.length < 2) throw new BadRequestException('name обязателен');
    const week = await this.parser.getWeekForTeacher(name);
    return week ?? { target: name, kind: 'teacher', days: [] };
  }

  /** Списки всех групп/преподавателей с недельного индекса (cg.htm / cp.htm). */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA)
  @Get('week/groups')
  async listWeeklyGroups() {
    return { items: await this.parser.listAllGroupsWeekly() };
  }

  @Roles(Role.SUPERADMIN, Role.ADM, Role.ADMINISTRATION, Role.COM, Role.TEA)
  @Get('week/teachers')
  async listWeeklyTeachers() {
    return { items: await this.parser.listAllTeachersWeekly() };
  }
}
