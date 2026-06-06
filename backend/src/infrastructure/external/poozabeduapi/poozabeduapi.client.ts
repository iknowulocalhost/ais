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
  /** Mutex: один активный login одновременно. */
  private busy: Promise<unknown> = Promise.resolve();

  constructor(private readonly cfg: ConfigService) {
    this.baseUrl = (cfg.get<string>('POOZABEDU_BASE_URL') ?? 'https://poo.zabedu.ru').replace(/\/$/, '');
    this.username = cfg.get<string>('POOZABEDU_USERNAME') ?? '';
    this.password = cfg.get<string>('POOZABEDU_PASSWORD') ?? '';
    this.requestTimeoutMs = numEnv(cfg, 'POOZABEDU_TIMEOUT_MS', 10_000);
    this.minIntervalMs = numEnv(cfg, 'POOZABEDU_MIN_INTERVAL_MS', 500);
  }

  /** login → fn → logout; параллельные вызовы сериализуются на mutex'е. */
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

  getSystemInfo(): Promise<SystemInfo> {
    return this.get<SystemInfo>('/services/people/system/info');
  }

  getOrganization(): Promise<OrganizationInfo> {
    return this.get<OrganizationInfo>('/services/people/organization');
  }

  getOrganizationStatistics(): Promise<OrganizationStatistics> {
    return this.get<OrganizationStatistics>('/services/people/organization/statistics');
  }

  // ─────── каталоги ───────

  listAllDepartments(): Promise<PzaDepartment[]> {
    return this.get<PzaDepartment[]>('/services/people/departments/all');
  }

  listAllStudentGroups(): Promise<PzaStudentGroup[]> {
    return this.get<PzaStudentGroup[]>('/services/people/student-groups/all');
  }

  listAllEmployees(): Promise<PzaEmployee[]> {
    return this.get<PzaEmployee[]>('/services/people/employees/all');
  }

  // ─────── студенты ───────

  listStudentsPage(pageIndex: number, pageSize = 200): Promise<PzaStudentsPage> {
    return this.get<PzaStudentsPage>('/services/people/students', {
      isActive: 'true',
      isEsia: 'false',
      orderBy: '+fullName',
      pageIndex,
      pageSize,
    });
  }

  getStudentDetail(externalId: number): Promise<PzaStudentDetail> {
    return this.get<PzaStudentDetail>(`/services/people/students/${externalId}`);
  }

  // ─────── журнал ───────

  listGradebookGroups(): Promise<PzaGradebookGroup[]> {
    return this.get<PzaGradebookGroup[]>('/services/journal/gradebook/student-groups');
  }

  getGradebookGroupEntries(groupExternalId: number): Promise<PzaGradebookEntry[]> {
    return this.get<PzaGradebookEntry[]>(
      `/services/journal/gradebook/${groupExternalId}/entries`,
    );
  }

  getGradebookSubject(gradebookId: number, subjectId: number): Promise<PzaGradebookSubject> {
    return this.get<PzaGradebookSubject>(
      `/services/journal/gradebook/${gradebookId}/subjects/${subjectId}`,
    );
  }

  // ─────── расписание ───────

  getScheduleGroupEntries(groupExternalId: number): Promise<PzaScheduleGroupEntries> {
    return this.get<PzaScheduleGroupEntries>(
      `/services/schedule/timetable/${groupExternalId}/entries`,
    );
  }

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

  getReport(relativePath: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    return this.get<unknown>(`/services/reports/${relativePath}`, query);
  }

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

    // прогрев: первичные cookies до логина
    await this.rawFetch('GET', '/security/');

    const body = JSON.stringify({
      login: this.username,
      password: buildLoginPasswordHash(this.password),
      isRemember: false,
    });
    const resp = await this.rawFetch('POST', '/services/security/login', body, 'application/json;charset=UTF-8');

    if (resp.status >= 400) {
      const text = await safeText(resp);
      throw new ServiceUnavailableException(
        `Сетевой ПОО: логин отклонён (HTTP ${resp.status}${text ? `, ${text}` : ''})`,
      );
    }

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
      await this.rawFetch('POST', '/services/security/logout').catch(() => undefined);
    } finally {
      this.loggedIn = false;
      this.cookies.clear();
    }
  }

  // ────────────────────────────── HTTP ──────────────────────────────

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
