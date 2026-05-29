import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  ChtotibParserService,
  ChtotibGroupLesson,
  ChtotibTeacherLesson,
  ChtotibSnapshot,
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

export interface TodayScheduleGroupSection {
  kind: 'group';
  groupName: string;
  lessons: ChtotibGroupLesson[];
}

export interface TodayScheduleTeacherSection {
  kind: 'teacher';
  teacherName: string;
  lessons: ChtotibTeacherLesson[];
}

export interface TodayScheduleResult {
  snapshot: ChtotibSnapshot;
  sections: Array<TodayScheduleGroupSection | TodayScheduleTeacherSection>;
}

/** Расписание на сегодня: STU → группа; TEA → группа + личное; остальные → пусто. */
@Injectable()
export class GetTodayScheduleUseCase {
  constructor(
    private readonly chtotib: ChtotibParserService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    @Inject(POOZABEDU_STUDENT_GROUP_REPOSITORY)
    private readonly groups: PoozabeduStudentGroupRepository,
  ) {}

  async execute(actor: AuthenticatedUser): Promise<TodayScheduleResult> {
    const sections: TodayScheduleResult['sections'] = [];

    if (actor.roles.includes(Role.STU)) {
      const section = await this.studentSection(actor.id);
      if (section) sections.push(section);
    }

    if (actor.roles.includes(Role.TEA)) {
      const groupSec = await this.teacherCuratedGroupSection(actor.netschoolEmployeeId ?? null);
      if (groupSec) sections.push(groupSec);

      const teacherSec = await this.teacherPersonalSection(actor.id);
      if (teacherSec) sections.push(teacherSec);
    }

    const snapshot = await this.chtotib.getSnapshot();
    return { snapshot, sections };
  }

  /* ───────────── helpers ───────────── */

  private async studentSection(
    userId: string,
  ): Promise<TodayScheduleGroupSection | null> {
    const user = await this.users.findById(userId);
    if (!user?.studentExternalId) return null;
    const student = await this.students.findByExternalId(user.studentExternalId);
    if (!student?.groupName) return null;
    const lessons = await this.chtotib.getGroupSchedule(student.groupName);
    return { kind: 'group', groupName: student.groupName, lessons };
  }

  private async teacherCuratedGroupSection(
    netschoolEmployeeId: number | null,
  ): Promise<TodayScheduleGroupSection | null> {
    if (!netschoolEmployeeId) return null;
    const groupIds = await this.groups.listOwnedExternalIdsByCurator(netschoolEmployeeId);
    if (groupIds.length === 0) return null;
    // Для упрощения берём первую закреплённую группу — обычно она одна.
    const all = await this.groups.listAll();
    const group = all.find((g) => g.externalId === groupIds[0]);
    if (!group) return null;
    const lessons = await this.chtotib.getGroupSchedule(group.name);
    return { kind: 'group', groupName: group.name, lessons };
  }

  private async teacherPersonalSection(
    userId: string,
  ): Promise<TodayScheduleTeacherSection | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    // Выбор по ФИО с проверкой инициалов — pickTeacherByFio фильтрует однофамильцев.
    const teachers = await this.chtotib.listTeachers();
    const match = pickTeacherByFio(teachers, user.lastName, user.firstName, user.middleName);
    if (!match) return null;
    const lessons = await this.chtotib.getTeacherSchedule(match);
    return { kind: 'teacher', teacherName: match, lessons };
  }
}

/** RBAC: STAFF — любую; TEA/STU — только свою; иначе ForbiddenException. */
export async function assertCanViewGroup(
  user: AuthenticatedUser,
  groupName: string,
  resolveUserGroup: () => Promise<string | null>,
  resolveTeacherGroups: () => Promise<string[]>,
): Promise<void> {
  if (
    user.roles.includes(Role.SUPERADMIN) ||
    user.roles.includes(Role.ADM) ||
    user.roles.includes(Role.ADMINISTRATION) ||
    user.roles.includes(Role.COM)
  ) {
    return;
  }
  if (user.roles.includes(Role.STU)) {
    const own = await resolveUserGroup();
    if (own && normalize(own) === normalize(groupName)) return;
  }
  if (user.roles.includes(Role.TEA)) {
    const owned = await resolveTeacherGroups();
    if (owned.some((g) => normalize(g) === normalize(groupName))) return;
  }
  throw new ForbiddenException('Просмотр этой группы недоступен');
}

function normalize(s: string): string {
  return s.replace(/[^а-яА-Яa-zA-Z0-9]/g, '').toLowerCase();
}

/** Подбор записи преподавателя по ФИО: фамилия ≥3 символов + дисамбигуация по инициалам. */
export function pickTeacherByFio(
  teachers: string[],
  lastName: string,
  firstName: string | null,
  middleName: string | null,
): string | null {
  const last = (lastName ?? '').trim().toLowerCase();
  if (last.length < 3) return null;
  const fi = (firstName ?? '').trim().slice(0, 1).toLowerCase();
  const mi = (middleName ?? '').trim().slice(0, 1).toLowerCase();

  // Корни: точная фамилия + без последней буквы (Ананьина → Ананьин).
  const roots = new Set<string>([last]);
  if (last.length > 3 && /[а-яё]$/i.test(last)) {
    roots.add(last.slice(0, -1));
  }

  const candidates = teachers.filter((t) => {
    const low = t.toLowerCase();
    for (const r of roots) {
      if (low.startsWith(r)) {
        const next = low.charAt(r.length);
        // Граница: пробел/точка/конец — точное совпадение фамилии.
        if (next === '' || next === ' ' || /[а-яa-z]/.test(next) === false) return true;
        // r — точно введённая фамилия → пропускаем «Ананьина» по корню «Ананьин».
        if (last === r) return true;
      }
    }
    return false;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (!fi) return null; // несколько однофамильцев без инициала имени — пас.

  const byFi = candidates.filter((t) => extractInitials(t)[0] === fi);
  if (byFi.length === 1) return byFi[0];
  if (byFi.length === 0) return null;
  if (!mi) return null;
  const byBoth = byFi.filter((t) => extractInitials(t)[1] === mi);
  return byBoth.length === 1 ? byBoth[0] : null;
}

/** Возвращает [инициал имени, инициал отчества] для «Иванов И.О.» / «Иванов И.». */
function extractInitials(teacherName: string): [string, string] {
  const low = teacherName.toLowerCase();
  // Берём первый и второй однобуквенный символ после фамилии.
  const matches = low.match(/[а-яa-z](?=\.)/g) ?? [];
  return [matches[0] ?? '', matches[1] ?? ''];
}
