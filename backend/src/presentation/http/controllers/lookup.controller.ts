import { Controller, Get, Inject, Query } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import {
  OrderLookupService,
  OrderLookupResult,
} from '../../../application/services/order-lookup.service';
import {
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import { GetStudentDetailUseCase } from '../../../application/use-cases/poozabedu/get-student-detail.use-case';

class LookupQueryDto {
  @IsString() @Length(2, 200) fullName!: string;
}

@Controller('lookup')
export class LookupController {
  constructor(
    private readonly lookup: OrderLookupService,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    private readonly studentDetailUc: GetStudentDetailUseCase,
  ) {}

  /**
   * Поиск студента в исторических CSV-выгрузках по ФИО.
   * Если CSV не покрывает запись — добираем дату/номер приказа о зачислении
   * из живого досье Сетевого ПОО (decrees[type=Enroll]). Это позволяет печатать
   * корректные справки для свежезачисленных студентов, которых ещё нет в CSV.
   * Используется печатными формами справок для автозаполнения.
   * Доступно сотрудникам — данные содержат ПДн.
   */
  @Roles(Role.SUPERADMIN, Role.ADM, Role.COM)
  @Get('order')
  async byFullName(@Query() q: LookupQueryDto): Promise<OrderLookupResult> {
    const csv = this.lookup.lookupByFullName(q.fullName);
    // Если CSV дал и enrollDate, и orderNumber, и gradYear — этого достаточно.
    if (csv.found && csv.enrollDate && csv.orderNumber && csv.gradYear) return csv;

    // Иначе пробуем найти студента в зеркале и поднять decrees из upstream.
    const enrich = await this.enrichFromDossier(q.fullName).catch(() => null);
    if (!enrich) return csv;
    return {
      ...csv,
      found: csv.found || enrich.found,
      enrollDate: csv.enrollDate ?? enrich.enrollDate,
      orderNumber: csv.orderNumber ?? enrich.orderNumber,
      gradYear: csv.gradYear ?? enrich.gradYear,
      course: csv.course ?? enrich.course,
    };
  }

  /**
   * Подсасывает данные о приказе о зачислении из живого досье Сетевого ПОО.
   * Год выпуска угадывает по дате приказа + 4 года (длительность СПО) — грубо,
   * но лучше пустого поля; если в CSV специальность есть, реальная длительность
   * берётся уже оттуда выше по слиянию.
   */
  private async enrichFromDossier(fullName: string): Promise<{
    found: boolean;
    enrollDate?: string;
    orderNumber?: string;
    gradYear?: number;
    course?: number;
  }> {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return { found: false };
    const [last, first, middle] = parts;
    const search = `${last} ${first}${middle ? ` ${middle}` : ''}`;
    const { items } = await this.students.list(
      { search, isActive: true },
      5,
      0,
    );
    const match = items.find(
      (s) =>
        s.lastName.toLowerCase() === last.toLowerCase() &&
        s.firstName.toLowerCase() === first.toLowerCase(),
    );
    if (!match) return { found: false };
    const detail = await this.studentDetailUc.execute(match.externalId);
    const enrollDecree = (detail.decrees ?? []).find((d) => d.type === 'Enroll');
    if (!enrollDecree) return { found: false };
    const enrollIso = parseDateToIso(enrollDecree.effectiveDate ?? enrollDecree.date);
    if (!enrollIso) return { found: false };
    const enrollYear = Number(enrollIso.slice(0, 4));
    // Дефолт по СПО — 4 года; если CSV знает специальность точнее, оно уже
    // переписало gradYear.
    const gradYear = enrollYear + 4;
    const today = new Date();
    const acYearStart = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    const enrollAcYear = Number(enrollIso.slice(5, 7)) >= 9 ? enrollYear : enrollYear - 1;
    const course = Math.min(Math.max(acYearStart - enrollAcYear + 1, 1), 4);
    return {
      found: true,
      enrollDate: enrollIso,
      orderNumber: enrollDecree.number || undefined,
      gradYear,
      course,
    };
  }
}

/** Принимает «yyyy-mm-dd» или ISO с временем — возвращает первые 10 символов. */
function parseDateToIso(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
