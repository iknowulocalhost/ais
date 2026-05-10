import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieJar } from './poozabeduapi.cookies';
import { buildLoginPasswordHash } from './poozabeduapi.session';
import {
  OrganizationInfo,
  OrganizationStatistics,
  PzaDepartment,
  PzaEmployee,
  PzaGradebookEntry,
  PzaGradebookGroup,
  PzaGradebookSubject,
  PzaScheduleClassrooms,
  PzaScheduleGroupEntries,
  PzaScheduleTeachers,
  PzaScheduleTimetable,
  PzaStudentDetail,
  PzaStudentGroup,
  PzaStudentsPage,
  SystemInfo,
} from './poozabeduapi.types';

/**
 * Клиент к АИС «Сетевой ПОО» (poo.zabedu.ru).
 *
 * Архитектурные ограничения:
 *  - **read-only**: ни одного «опасного» метода. Все API — GET, кроме обязательных
 *    POST /security/login и POST /security/logout. Зеркалит требование 152-ФЗ
 *    «никаких неожиданных модификаций внешней системы».
 *  - **single-account**: на школу один технический пользователь, у IRTech ограничен
 *    пул одновременных сессий. Поэтому используем паттерн `withSession()`:
 *    login → работа → logout в пределах одного вызова. Idle-сессия не висит.
 *  - **mutex**: внутри процесса не пускаем параллельные sync-job'ы одновременно
 *    держать логин — иначе вторая попытка получит «session limit exceeded».
 *    Для multi-instance деплоя вместо in-memory mutex'а — Redis-lock (этап 2+).
 *  - **rate-limit**: пауза между запросами, чтобы не уронить сервер.
 *  - **аудит**: вызовы логгируются (без секретов в логах).
 *
 * Конфигурация (env):
 *   POOZABEDU_BASE_URL       https://poo.zabedu.ru
 *   POOZABEDU_USERNAME       технический логин
 *   POOZABEDU_PASSWORD       пароль (плейн; в проде — через секрет-менеджер)
 *   POOZABEDU_TIMEOUT_MS     таймаут запроса, по умолчанию 10000
 *   POOZABEDU_MIN_INTERVAL_MS  минимум между запросами, по умолчанию 500
 */
@Injectable()
export class PoozabeduApiClient {
  private readonly logger = new Logger(PoozabeduApiClient.name);

  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly requestTimeoutMs: number;
  private readonly minIntervalMs: number;

  private cookies = new CookieJar();
  private loggedIn = false;
  private lastRequestAt = 0;
  /** Mutex на уровне процесса — гарантирует один активный login одновременно. */
  private busy: Promise<unknown> = Promise.resolve();

  constructor(private readonly cfg: ConfigService) {
    this.baseUrl = (cfg.get<string>('POOZABEDU_BASE_URL') ?? 'https://poo.zabedu.ru').replace(/\/$/, '');
    this.username = cfg.get<string>('POOZABEDU_USERNAME') ?? '';
    this.password = cfg.get<string>('POOZABEDU_PASSWORD') ?? '';
    this.requestTimeoutMs = numEnv(cfg, 'POOZABEDU_TIMEOUT_MS', 10_000);
    this.minIntervalMs = numEnv(cfg, 'POOZABEDU_MIN_INTERVAL_MS', 500);
  }

  /**
   * Гарантирует свежую сессию на время работы fn, после — logout.
   * Все sync-job'ы ходят сюда. Параллельные вызовы сериализуются на mutex'е.
   */
  async withSession<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.busy;
    let release!: () => void;
    this.busy = new Promise<void>((r) => (release = r));
    try {
      await previous;
      this.assertConfigured();
      await this.login();
      try {
        return await fn();
      } finally {
        await this.logout().catch((e) => {
          this.logger.warn(`logout сбойнул, но это не критично: ${(e as Error).message}`);
        });
      }
    } finally {
      release();
    }
  }

  // ────────── high-level helpers (read-only) ──────────

  /** `GET /services/people/system/info` — версии, язык, флаги. */
  getSystemInfo(): Promise<SystemInfo> {
    return this.get<SystemInfo>('/services/people/system/info');
  }

  /** `GET /services/people/organization` — карточка ОО. */
  getOrganization(): Promise<OrganizationInfo> {
    return this.get<OrganizationInfo>('/services/people/organization');
  }

  /** `GET /services/people/organization/statistics` — числа по ОО. */
  getOrganizationStatistics(): Promise<OrganizationStatistics> {
    return this.get<OrganizationStatistics>('/services/people/organization/statistics');
  }

  // ─────── каталоги ───────

  /** Все подразделения школы (4 записи на нашей инсталляции). */
  listAllDepartments(): Promise<PzaDepartment[]> {
    return this.get<PzaDepartment[]>('/services/people/departments/all');
  }

  /** Все учебные группы (85 записей). Возвращает плоский список. */
  listAllStudentGroups(): Promise<PzaStudentGroup[]> {
    return this.get<PzaStudentGroup[]>('/services/people/student-groups/all');
  }

  /** Все сотрудники (162 записи). Используется для дропдауна привязки TEA-аккаунтов. */
  listAllEmployees(): Promise<PzaEmployee[]> {
    return this.get<PzaEmployee[]>('/services/people/employees/all');
  }

  // ─────── студенты ───────

  /**
   * Страница списка студентов. Параметры пагинации совпадают с UI Сетевого ПОО.
   * `isActive=true` — без отчисленных; `isEsia=false` — без фильтра по Госуслугам.
   * orderBy `+fullName` — стабильная сортировка для надёжных дельт.
   */
  listStudentsPage(pageIndex: number, pageSize = 200): Promise<PzaStudentsPage> {
    return this.get<PzaStudentsPage>('/services/people/students', {
      isActive: 'true',
      isEsia: 'false',
      orderBy: '+fullName',
      pageIndex,
      pageSize,
    });
  }

  /**
   * Детальная карточка студента — содержит ПДн (паспорт/адреса/СНИЛС/родители).
   * Используется только для on-demand проксирования к авторизованному оператору,
   * НЕ для сохранения в нашу БД.
   */
  getStudentDetail(externalId: number): Promise<PzaStudentDetail> {
    return this.get<PzaStudentDetail>(`/services/people/students/${externalId}`);
  }

  // ─────── журнал ───────

  /** Группы, у которых есть журнал. */
  listGradebookGroups(): Promise<PzaGradebookGroup[]> {
    return this.get<PzaGradebookGroup[]>('/services/journal/gradebook/student-groups');
  }

  /** Журнал группы — список семестров и предметов в каждом. */
  getGradebookGroupEntries(groupExternalId: number): Promise<PzaGradebookEntry[]> {
    return this.get<PzaGradebookEntry[]>(
      `/services/journal/gradebook/${groupExternalId}/entries`,
    );
  }

  /** Журнал по предмету: РПД, проведённые уроки, оценки и пропуски, средние баллы. */
  getGradebookSubject(gradebookId: number, subjectId: number): Promise<PzaGradebookSubject> {
    return this.get<PzaGradebookSubject>(
      `/services/journal/gradebook/${gradebookId}/subjects/${subjectId}`,
    );
  }

  // ─────── расписание ───────

  /** Список планов расписания у группы. */
  getScheduleGroupEntries(groupExternalId: number): Promise<PzaScheduleGroupEntries> {
    return this.get<PzaScheduleGroupEntries>(
      `/services/schedule/timetable/${groupExternalId}/entries`,
    );
  }

  /**
   * Расписание за период. `dateFrom`/`dateTo` в формате `yyyy-mm-dd`.
   * `type` — обычно `studentGroup` (можно и `teacher` через тот же эндпоинт).
   * `id` — идентификатор плана расписания со стороны IRTech.
   */
  getScheduleTimetable(
    dateFrom: string,
    dateTo: string,
    type: 'studentGroup' | 'teacher',
    id: number,
  ): Promise<PzaScheduleTimetable> {
    return this.get<PzaScheduleTimetable>(
      `/services/schedule/timetable/${dateFrom}/${dateTo}`,
      { type, id },
    );
  }

  listScheduleTeachers(): Promise<PzaScheduleTeachers> {
    return this.get<PzaScheduleTeachers>('/services/schedule/timetable/teachers');
  }

  listScheduleClassrooms(): Promise<PzaScheduleClassrooms> {
    return this.get<PzaScheduleClassrooms>('/services/schedule/timetable/classrooms');
  }

  // ─────── reports ───────

  /**
   * Универсальный прокси к `/services/reports/...`. Тип `unknown` намеренно:
   * у Сетевого ПОО под капотом 20+ отчётов с разной структурой, типизировать каждый
   * на нашей стороне быстро устаревает. Контроллер валидирует safe-path до вызова.
   */
  getReport(relativePath: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    return this.get<unknown>(`/services/reports/${relativePath}`, query);
  }

  /**
   * Smoke: один полный round-trip — login → organization + statistics → logout.
   * Используется в `/api/poozabeduapi/ping` админ-эндпоинте.
   */
  async ping(): Promise<{
    organization: OrganizationInfo;
    statistics: OrganizationStatistics;
    systemInfo: SystemInfo;
  }> {
    return this.withSession(async () => ({
      systemInfo: await this.getSystemInfo(),
      organization: await this.getOrganization(),
      statistics: await this.getOrganizationStatistics(),
    }));
  }

  // ────────────────────────────── auth ──────────────────────────────

  private async login(): Promise<void> {
    this.cookies = new CookieJar();
    this.loggedIn = false;

    // 1) Прогрев — забрать первичные cookies (если сервер их выставляет до логина).
    await this.rawFetch('GET', '/security/');

    // 2) Сам логин — JSON POST с base64(sha256(password)).
    const body = JSON.stringify({
      login: this.username,
      password: buildLoginPasswordHash(this.password),
      isRemember: false,
    });
    const resp = await this.rawFetch('POST', '/services/security/login', body, 'application/json;charset=UTF-8');

    // У Сетевого ПОО при успешном логине тело пустое, статус 200.
    // Поправка: некоторые сборки возвращают 401/403 при неверных кредах.
    if (resp.status >= 400) {
      const text = await safeText(resp);
      throw new ServiceUnavailableException(
        `Сетевой ПОО: логин отклонён (HTTP ${resp.status}${text ? `, ${text}` : ''})`,
      );
    }

    // Cookies должны были выставиться через ingest в rawFetch. Если не выставились —
    // значит, аутентификация молча провалилась.
    if (this.cookies.size() === 0) {
      throw new ServiceUnavailableException(
        'Сетевой ПОО: логин принят, но сессионные cookies не получены',
      );
    }
    this.loggedIn = true;
    this.logger.log(`poozabeduapi: логин ОК, cookies в банке: ${this.cookies.size()}`);
  }

  private async logout(): Promise<void> {
    if (!this.loggedIn) return;
    try {
      // Попытка освободить серверный слот сессии.
      // Если эндпоинт у вашей сборки другой — невелика беда, логаут произойдёт по таймауту.
      await this.rawFetch('POST', '/services/security/logout').catch(() => undefined);
    } finally {
      this.loggedIn = false;
      this.cookies.clear();
    }
  }

  // ────────────────────────────── HTTP ──────────────────────────────

  /** Низкоуровневый GET с автодеcериализацией JSON. Требует активной сессии. */
  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    if (!this.loggedIn) {
      throw new ServiceUnavailableException('Сетевой ПОО: вызов без активной сессии');
    }
    const url = this.buildUrl(path, query);
    const resp = await this.rawFetch('GET', url);
    if (resp.status === 204) return undefined as T;
    const text = await resp.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ServiceUnavailableException(
        `Сетевой ПОО: ответ не JSON (status=${resp.status}, length=${text.length})`,
      );
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const u = new URL(path, this.baseUrl + '/');
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  private async rawFetch(
    method: string,
    pathOrUrl: string,
    body?: string,
    contentType?: string,
  ): Promise<Response> {
    await this.respectRateLimit();
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : this.baseUrl + pathOrUrl;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.requestTimeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      Referer: this.baseUrl + '/',
      Origin: this.baseUrl,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (contentType) headers['Content-Type'] = contentType;
    const cookieHeader = this.cookies.header();
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: ctrl.signal,
      });

      const setCookies = resp.headers.getSetCookie?.() ?? [];
      if (setCookies.length) this.cookies.ingest(setCookies);

      // 401 / 3xx-redirect-на-/security/ обычно означает, что сессия отвалилась.
      // На текущем этапе бросаем ошибку — следующий тик переоткроет сессию.
      if (resp.status === 401) {
        throw new ServiceUnavailableException('Сетевой ПОО: HTTP 401 — сессия истекла');
      }
      if (resp.status >= 500) {
        throw new ServiceUnavailableException(`Сетевой ПОО: HTTP ${resp.status}`);
      }
      return resp;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException(`Сетевой ПОО: таймаут запроса ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const wait = this.minIntervalMs - (now - this.lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  private assertConfigured(): void {
    if (!this.username || !this.password) {
      throw new ServiceUnavailableException(
        'poozabeduapi: не настроены POOZABEDU_USERNAME / POOZABEDU_PASSWORD',
      );
    }
  }
}

function numEnv(cfg: ConfigService, key: string, def: number): number {
  const v = cfg.get<string>(key);
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function safeText(resp: Response): Promise<string> {
  try {
    const t = await resp.text();
    return t.slice(0, 200);
  } catch {
    return '';
  }
}
