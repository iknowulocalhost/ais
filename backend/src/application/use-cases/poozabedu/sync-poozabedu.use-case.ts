import { Inject, Injectable, Logger } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import {
  POOZABEDU_DEPARTMENT_REPOSITORY,
  POOZABEDU_STUDENT_GROUP_REPOSITORY,
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduDepartmentRepository,
  PoozabeduStudentGroupRepository,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  PoozabeduDepartment,
  PoozabeduStudent,
  PoozabeduStudentGroup,
} from '../../../domain/entities/poozabedu-mirror.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import {
  PzaDepartment,
  PzaStudentGroup,
  PzaStudentSummary,
} from '../../../infrastructure/external/poozabeduapi/poozabeduapi.types';

export interface SyncReport {
  departments: { total: number; deactivated: number };
  groups: { total: number; deactivated: number };
  students: { total: number; pages: number; deactivated: number };
  /** Аккаунты студентов, которым пришлось переключить is_active по итогам sync'а. */
  accounts: { disabled: number; enabled: number };
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

const STUDENT_PAGE_SIZE = 200;

/**
 * Полная синхронизация трёх каталогов из Сетевого ПОО → наше «зеркало».
 * Делается под ОДНОЙ сессией (`withSession`), чтобы не дёргать login-logout
 * между шагами — у IRTech ограниченный пул сессий.
 *
 * Порядок: departments → groups → students (по убыванию редкости и логически
 * сверху вниз). Все три шага объединяются в один аудит-запись.
 *
 * Стратегия дельт: collect-then-upsert. Полностью читаем upstream в память,
 * потом одной транзакцией upsert + одна `deactivateExcept`. Промежуточных
 * несогласованных состояний у клиента UI не наблюдается.
 */
@Injectable()
export class SyncPoozabeduUseCase {
  private readonly logger = new Logger(SyncPoozabeduUseCase.name);

  constructor(
    private readonly api: PoozabeduApiClient,
    @Inject(POOZABEDU_DEPARTMENT_REPOSITORY) private readonly deptRepo: PoozabeduDepartmentRepository,
    @Inject(POOZABEDU_STUDENT_GROUP_REPOSITORY) private readonly groupRepo: PoozabeduStudentGroupRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY) private readonly studentRepo: PoozabeduStudentRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(): Promise<SyncReport> {
    const startedAt = new Date();
    this.logger.log('poozabeduapi sync: старт');

    const result = await this.api.withSession(async () => {
      const depts = await this.api.listAllDepartments();
      const groups = await this.api.listAllStudentGroups();
      const studentsRaw = await this.collectAllStudents();
      return { depts, groups, students: studentsRaw };
    });

    // Подразделения
    const now = new Date();
    const deptDomain = result.depts.map((d) => mapDept(d, now));
    await this.deptRepo.upsertMany(deptDomain);
    const deptDeactivated = await this.deptRepo.deactivateExcept(deptDomain.map((d) => d.externalId));

    // Группы
    const groupDomain = result.groups.map((g) => mapGroup(g, now));
    await this.groupRepo.upsertMany(groupDomain);
    const groupDeactivated = await this.groupRepo.deactivateExcept(groupDomain.map((g) => g.externalId));

    // Студенты
    const studentDomain = result.students.map((s) => mapStudent(s, now));
    await this.studentRepo.upsertMany(studentDomain);
    const studentDeactivated = await this.studentRepo.deactivateExcept(studentDomain.map((s) => s.externalId));

    // После того как зеркало студентов обновилось — выравниваем `users.is_active`
    // под `poozabedu_student.is_active`. При отчислении студент в зеркале
    // отмечается inactive, и его аккаунт АИС автоматически отключается; при
    // восстановлении в Сетевом — аккаунт возвращается к жизни.
    const accountSync = await this.userRepo.syncActiveFromStudentMirror();

    const finishedAt = new Date();
    const report: SyncReport = {
      departments: { total: deptDomain.length, deactivated: deptDeactivated },
      groups: { total: groupDomain.length, deactivated: groupDeactivated },
      students: {
        total: studentDomain.length,
        pages: Math.ceil(studentDomain.length / STUDENT_PAGE_SIZE),
        deactivated: studentDeactivated,
      },
      accounts: accountSync,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'PoozabeduSync',
      entityId: null,
      newState: {
        departments: report.departments,
        groups: report.groups,
        students: report.students,
        durationMs: report.durationMs,
      },
    });

    this.logger.log(
      `poozabeduapi sync: готово за ${report.durationMs}мс — ` +
      `dept=${report.departments.total}/-${report.departments.deactivated}, ` +
      `group=${report.groups.total}/-${report.groups.deactivated}, ` +
      `student=${report.students.total}/-${report.students.deactivated}, ` +
      `accounts: -${report.accounts.disabled}/+${report.accounts.enabled}`,
    );

    return report;
  }

  private async collectAllStudents(): Promise<PzaStudentSummary[]> {
    const all: PzaStudentSummary[] = [];
    let pageIndex = 0;
    let total = Number.POSITIVE_INFINITY;
    while (all.length < total) {
      const page = await this.api.listStudentsPage(pageIndex, STUDENT_PAGE_SIZE);
      total = page.studentsCount ?? page.students.length;
      all.push(...page.students);
      if (page.students.length < STUDENT_PAGE_SIZE) break;
      pageIndex++;
      // Сейф-лимит на случай если IRTech начнёт возвращать пустую страницу.
      if (pageIndex > 100) break;
    }
    return all;
  }
}

// ─────── мапперы upstream → доменное «зеркало» ───────

function mapDept(d: PzaDepartment, now: Date): PoozabeduDepartment {
  return new PoozabeduDepartment(
    '',                   // id заполнит БД (uuid default)
    d.id,
    (d.name ?? '').trim(),
    d.managerId ?? null,
    true,
    now,
  );
}

function mapGroup(g: PzaStudentGroup, now: Date): PoozabeduStudentGroup {
  return new PoozabeduStudentGroup(
    '',
    g.id,
    (g.name ?? '').trim(),
    g.code ?? null,
    g.yearNumber ?? null,
    g.educationForm ?? null,
    g.departmentId ?? null,
    g.curatorId ?? null,
    true,
    now,
  );
}

function mapStudent(s: PzaStudentSummary, now: Date): PoozabeduStudent {
  return new PoozabeduStudent(
    '',
    s.id,
    (s.lastName ?? '').trim(),
    (s.firstName ?? '').trim(),
    s.middleName?.trim() || null,
    parseIrTechDate(s.birthday),
    s.gender ?? null,
    s.studentGroup?.id ?? null,
    s.studentGroup?.name?.trim() ?? null,
    s.educationBasis ?? null,
    typeof s.gradePointAverage === 'number' ? s.gradePointAverage : null,
    true,
    now,
  );
}

/**
 * IRTech отдаёт даты в формате `2009-02-07T00:00:00.0000000` (7 цифр после точки).
 * `new Date(...)` это сжуёт, но приведение к началу суток в локальной зоне ОО
 * нам важнее. Берём только дату, без времени.
 */
function parseIrTechDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!ymd) return null;
  return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
}
