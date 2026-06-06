import { Inject, Injectable } from '@nestjs/common';
import {
  ChtotibParserService,
  ChtotibWeek,
} from '../../../infrastructure/external/chtotib/chtotib-parser.service';
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
import { Role } from '../../../domain/enums/role.enum';
import { AuthenticatedUser } from '../../../presentation/http/auth/jwt.strategy';
import { pickTeacherByFio } from './get-today-schedule.use-case';

export interface WeekScheduleResult {
  sections: ChtotibWeek[];
}

/** Расписание на неделю: STU → группа; TEA → группа + личное; STAFF → пусто. */
@Injectable()
export class GetWeekScheduleUseCase {
  constructor(
    private readonly chtotib: ChtotibParserService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    @Inject(POOZABEDU_STUDENT_GROUP_REPOSITORY)
    private readonly groups: PoozabeduStudentGroupRepository,
  ) {}

  async execute(actor: AuthenticatedUser): Promise<WeekScheduleResult> {
    const sections: ChtotibWeek[] = [];

    if (actor.roles.includes(Role.STU)) {
      const s = await this.studentSection(actor.id);
      if (s) sections.push(s);
    }

    if (actor.roles.includes(Role.TEA)) {
      const g = await this.teacherGroupSection(actor.netschoolEmployeeId ?? null);
      if (g) sections.push(g);
      const t = await this.teacherPersonalSection(actor.id);
      if (t) sections.push(t);
    }

    return { sections };
  }

  private async studentSection(userId: string): Promise<ChtotibWeek | null> {
    const u = await this.users.findById(userId);
    if (!u?.studentExternalId) return null;
    const student = await this.students.findByExternalId(u.studentExternalId);
    if (!student?.groupName) return null;
    return this.chtotib.getWeekForGroup(student.groupName);
  }

  private async teacherGroupSection(employeeId: number | null): Promise<ChtotibWeek | null> {
    if (!employeeId) return null;
    const ids = await this.groups.listOwnedExternalIdsByCurator(employeeId);
    if (ids.length === 0) return null;
    const all = await this.groups.listAll();
    const group = all.find((g) => g.externalId === ids[0]);
    if (!group) return null;
    return this.chtotib.getWeekForGroup(group.name);
  }

  private async teacherPersonalSection(userId: string): Promise<ChtotibWeek | null> {
    const u = await this.users.findById(userId);
    if (!u) return null;
    // ФИО-дисамбигуация заранее — иначе startsWith ловит однофамильцев.
    const list = await this.chtotib.listAllTeachersWeekly();
    const match = pickTeacherByFio(list, u.lastName, u.firstName, u.middleName);
    if (!match) return null;
    return this.chtotib.getWeekForTeacher(match);
  }
}
