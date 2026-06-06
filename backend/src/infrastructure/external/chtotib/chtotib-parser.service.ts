import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as iconv from 'iconv-lite';

/** Парсер chtotib.ru/schedule_gl: hg.htm (группы) + hp.htm (преподаватели). */

export interface ChtotibGroupLesson {
  period: number;
  subject: string;
  teacher: string;
  room: string;
}

export interface ChtotibTeacherLesson {
  period: number;
  groupOrSubject: string;
  detail: string;
  room: string;
}

export interface ChtotibSnapshot {
  scheduleDate: string;
  fetchedAt: string;
}

/* ───── Недельное расписание ───── */

export interface ChtotibWeekEntry {
  subjectOrGroup: string;
  teacherOrSubject: string;
  room: string;
  /** 1/2 — подгруппа; undefined — общая. */
  subgroup?: 1 | 2;
}

export interface ChtotibWeekSlot {
  period: number;
  entries: ChtotibWeekEntry[];
}

export interface ChtotibWeekDay {
  date: string;
  weekday: string;
  slots: ChtotibWeekSlot[];
}

export interface ChtotibWeek {
  target: string;
  kind: 'group' | 'teacher';
  days: ChtotibWeekDay[];
}

@Injectable()
export class ChtotibParserService {
  private readonly logger = new Logger(ChtotibParserService.name);

  private static readonly TTL_MS = 5 * 60 * 1000;
  private static readonly INDEX_TTL_MS = 60 * 60 * 1000;
  private hgCache: { fetchedAt: number; html: string } | null = null;
  private hpCache: { fetchedAt: number; html: string } | null = null;
  private groupIndexCache: { fetchedAt: number; map: Map<string, string> } | null = null;
  private teacherIndexCache: { fetchedAt: number; map: Map<string, string> } | null = null;
  private weekPageCache = new Map<string, { fetchedAt: number; html: string }>();

  /** CHTOTIB_BASE_URL: по умолчанию GitHub-зеркало chtotib-it.github.io. */
  private readonly baseUrl: string;
  private readonly urlHg: string;
  private readonly urlHp: string;

  constructor(cfg: ConfigService) {
    const raw = cfg.get<string>('CHTOTIB_BASE_URL') ?? 'https://chtotib-it.github.io/';
    this.baseUrl = raw.endsWith('/') ? raw : `${raw}/`;
    this.urlHg = `${this.baseUrl}hg.htm`;
    this.urlHp = `${this.baseUrl}hp.htm`;
  }

  /* ───────────── публичные методы ───────────── */

  /** Список всех групп, упомянутых на странице hg.htm. */
  async listGroups(): Promise<string[]> {
    const html = await this.getHg();
    return uniqueNames(extractFirstColumnNames(html));
  }

  /** Список преподавателей со страницы hp.htm. */
  async listTeachers(): Promise<string[]> {
    const html = await this.getHp();
    return uniqueNames(extractFirstColumnNames(html), 40);
  }

  /** Расписание группы — список пар с дисциплинами, кабинетами и преподавателями. */
  async getGroupSchedule(groupName: string): Promise<ChtotibGroupLesson[]> {
    const html = await this.getHg();
    return parseScheduleRows(html, groupName, 'group');
  }

  /** Расписание конкретного преподавателя. */
  async getTeacherSchedule(teacherName: string): Promise<ChtotibTeacherLesson[]> {
    const html = await this.getHp();
    return parseScheduleRows(html, teacherName, 'teacher');
  }

  /** Дата расписания, как написана в HTML (заголовок <li class=zgr>). */
  async getSnapshot(): Promise<ChtotibSnapshot> {
    const html = await this.getHg();
    return {
      scheduleDate: extractScheduleDate(html) ?? 'не определена',
      fetchedAt: new Date(this.hgCache?.fetchedAt ?? Date.now()).toISOString(),
    };
  }

  /* ───────────── недельное расписание ─────────────
     На chtotib-it.github.io индексные страницы `cg.htm`/`cp.htm` содержат
     ссылки `cgN.htm`/`cpN.htm` для каждой группы/преподавателя. Внутри —
     полная недельная сетка пар (8 пар × 6-7 дней) с подгруппами.
     Парсинг: сначала загружаем индекс, ищем нужное имя → имя файла, потом
     скачиваем сам файл и разбираем таблицу. */

  /** Все имена групп с недельной страницы (карта name → htm-файл). */
  async listAllGroupsWeekly(): Promise<string[]> {
    const map = await this.getGroupIndex();
    return [...map.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  /** Все имена преподавателей с недельной страницы (карта name → htm-файл). */
  async listAllTeachersWeekly(): Promise<string[]> {
    const map = await this.getTeacherIndex();
    return [...map.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  async getWeekForGroup(groupName: string): Promise<ChtotibWeek | null> {
    const map = await this.getGroupIndex();
    const file = findInIndex(map, groupName);
    if (!file) return null;
    const html = await this.getWeekPage(file);
    return { target: groupName, kind: 'group', days: parseWeekTable(html, 'group') };
  }

  async getWeekForTeacher(teacherName: string): Promise<ChtotibWeek | null> {
    const map = await this.getTeacherIndex();
    const file = findInIndex(map, teacherName);
    if (!file) return null;
    const html = await this.getWeekPage(file);
    return { target: teacherName, kind: 'teacher', days: parseWeekTable(html, 'teacher') };
  }

  private async getGroupIndex(): Promise<Map<string, string>> {
    if (
      this.groupIndexCache &&
      Date.now() - this.groupIndexCache.fetchedAt < ChtotibParserService.INDEX_TTL_MS
    ) return this.groupIndexCache.map;
    const html = await this.download(`${this.baseUrl}cg.htm`);
    const map = extractIndexLinks(html, 'cg');
    this.groupIndexCache = { fetchedAt: Date.now(), map };
    return map;
  }

  private async getTeacherIndex(): Promise<Map<string, string>> {
    if (
      this.teacherIndexCache &&
      Date.now() - this.teacherIndexCache.fetchedAt < ChtotibParserService.INDEX_TTL_MS
    ) return this.teacherIndexCache.map;
    const html = await this.download(`${this.baseUrl}cp.htm`);
    const map = extractIndexLinks(html, 'cp');
    this.teacherIndexCache = { fetchedAt: Date.now(), map };
    return map;
  }

  private async getWeekPage(file: string): Promise<string> {
    const cached = this.weekPageCache.get(file);
    if (cached && Date.now() - cached.fetchedAt < ChtotibParserService.TTL_MS) {
      return cached.html;
    }
    const html = await this.download(`${this.baseUrl}${file}`);
    this.weekPageCache.set(file, { fetchedAt: Date.now(), html });
    return html;
  }

  /* ───────────── загрузка с кешем ───────────── */

  private async getHg(): Promise<string> {
    if (this.hgCache && Date.now() - this.hgCache.fetchedAt < ChtotibParserService.TTL_MS) {
      return this.hgCache.html;
    }
    const html = await this.download(this.urlHg);
    this.hgCache = { fetchedAt: Date.now(), html };
    return html;
  }

  private async getHp(): Promise<string> {
    if (this.hpCache && Date.now() - this.hpCache.fetchedAt < ChtotibParserService.TTL_MS) {
      return this.hpCache.html;
    }
    const html = await this.download(this.urlHp);
    this.hpCache = { fetchedAt: Date.now(), html };
    return html;
  }

  /** Скачать страницу (rejectUnauthorized: false, авто-кодировка utf-8/cp1251). */
  private download(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        { rejectUnauthorized: false, timeout: 15_000 },
        (res) => {
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume();
            reject(new Error(`chtotib.ru responded ${res.statusCode} for ${url}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            resolve(decodeHtml(buf));
          });
          res.on('error', reject);
        },
      );
      req.on('timeout', () => req.destroy(new Error(`chtotib.ru timeout: ${url}`)));
      req.on('error', reject);
    });
  }
}

/* ───────────── helpers (чистые функции, тестируются изолированно) ───────────── */

function decodeHtml(buf: Buffer): string {
  // UTF-8 ⟶ если получили U+FFFD (replacement char) или явный «вопросительный
  // мусор» — пробуем cp1251. Эвристика грубая, но для двух конкретных страниц
  // достаточна (других страниц мы здесь не парсим).
  const utf = buf.toString('utf-8');
  if (!utf.includes('�') && /[а-яА-Я]/.test(utf)) return utf;
  return iconv.decode(buf, 'win1251');
}

function normalizeName(name: string): string {
  return name.replace(/[^а-яА-Яa-zA-Z0-9]/g, '').toLowerCase();
}

/** HTML → одна строка без тегов и лишних пробелов (для regexp-парсинга). */
function flattenHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ');
}

/** Извлекает все `<tr>...</tr>` из HTML. */
function extractRows(html: string): string[] {
  return Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((m) => m[1]);
}

/** Делит строку TR на ячейки, очищая HTML и `&nbsp;`. */
function extractCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim(),
  );
}

const IGNORED_FIRST_COL = [
  'пара',
  'время',
  'дисциплина',
  'преподаватель',
  'кабинет',
  'оглавление',
  'назад',
  'расписание',
  'группа',
];

/** Имена из первого столбца (групп для hg.htm / ФИО для hp.htm). */
function extractFirstColumnNames(html: string): string[] {
  const flat = flattenHtml(html);
  const rows = extractRows(flat);
  const names: string[] = [];
  for (const row of rows) {
    const cols = extractCells(row);
    if (!cols.length) continue;
    const first = cols[0].replace(/\s+/g, ' ').trim();
    if (!first) continue;
    if (!/[а-яА-Яa-zA-Z]/.test(first)) continue;
    const lower = first.toLowerCase();
    if (IGNORED_FIRST_COL.some((w) => lower.includes(w))) continue;
    names.push(first);
  }
  return names;
}

function uniqueNames(names: string[], maxLen = 20): string[] {
  const set = new Set<string>();
  for (const n of names) {
    if (n.length > 2 && n.length <= maxLen) set.add(n);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

/** Парсит таблицу пар с учётом rowspan на первом столбце. */
function parseScheduleRows(
  html: string,
  target: string,
  mode: 'group',
): ChtotibGroupLesson[];
function parseScheduleRows(
  html: string,
  target: string,
  mode: 'teacher',
): ChtotibTeacherLesson[];
function parseScheduleRows(
  html: string,
  target: string,
  mode: 'group' | 'teacher',
): ChtotibGroupLesson[] | ChtotibTeacherLesson[] {
  const flat = flattenHtml(html);
  const rows = extractRows(flat);
  const targetNorm = normalizeName(target);
  if (!targetNorm) return [];

  const groupOut: ChtotibGroupLesson[] = [];
  const teacherOut: ChtotibTeacherLesson[] = [];
  let currentName = '';

  for (const row of rows) {
    const cols = extractCells(row);
    if (!cols.length) continue;

    let periodIdx: number;
    if (/[а-яА-Яa-zA-Z]/.test(cols[0])) {
      currentName = cols[0];
      periodIdx = 1;
    } else {
      periodIdx = 0;
    }

    if (normalizeName(currentName) !== targetNorm) continue;
    if (cols.length <= periodIdx) continue;

    const periodRaw = cols[periodIdx];
    const periodDigits = periodRaw.replace(/\D/g, '');
    const period = Number(periodDigits);
    if (!Number.isFinite(period) || period <= 0) continue;

    const c1 = (cols[periodIdx + 1] ?? '').replace(/\s+/g, ' ').trim();
    const c2 = (cols[periodIdx + 2] ?? '').replace(/\s+/g, ' ').trim();
    const c3 = (cols[periodIdx + 3] ?? '').replace(/\s+/g, ' ').trim();

    if (mode === 'group') {
      // group page: subject | teacher | room
      if (!c1 || c1.length < 2) continue;
      groupOut.push({ period, subject: c1, teacher: c2, room: c3 });
    } else {
      // teacher page: group | subject | room
      if ((!c1 && !c2) || c1.length + c2.length < 2) continue;
      teacherOut.push({ period, groupOrSubject: c1, detail: c2, room: c3 });
    }
  }

  return mode === 'group' ? groupOut : teacherOut;
}

/** Дата расписания из `<li class=zgr>...</li>` в начале страницы. */
function extractScheduleDate(html: string): string | null {
  const m = /<li\s+class=zgr>([\s\S]*?)<\/li>/i.exec(html);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

/* ───────── helpers для недельного расписания ───────── */

/** cg.htm/cp.htm → Map(имя → файл cgN.htm/cpN.htm). */
function extractIndexLinks(html: string, prefix: 'cg' | 'cp'): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`<a[^>]+href="(${prefix}\\d+\\.htm)"[^>]*>([^<]+)<\\/a>`, 'gi');
  for (const m of html.matchAll(re)) {
    const file = m[1];
    const name = m[2].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    // Если две ссылки на один файл — оставляем первую (это обычно одна и та же группа).
    if (!out.has(name)) out.set(name, file);
  }
  return out;
}

/** Поиск в индексе с нормализацией (без учёта пробелов/дефисов и регистра). */
function findInIndex(map: Map<string, string>, name: string): string | null {
  const direct = map.get(name);
  if (direct) return direct;
  const norm = normalizeName(name);
  // Без этой проверки `''.startsWith('')` ниже даст ПЕРВЫЙ ключ карты
  // на пустом/слишком коротком входе — это и было источником матча
  // «Ананьин Д.А.» для служебной AD-учётки `test` без фамилии.
  if (norm.length < 3) return null;
  for (const [k, v] of map) {
    if (normalizeName(k) === norm) return v;
  }
  // fallback: для преподавателей user.lastName может не совпадать с записью
  // «Иванов И.И.» точно — пробуем startsWith по нормализованной фамилии.
  // ВАЖНО: если в индексе несколько ключей, начинающихся с этого корня
  // (однофамильцы), отдаём `null` — у нас тут нет инициалов для выбора,
  // лучше вернуть пусто, чем чужое расписание. Дисамбигуацию по инициалам
  // должен делать use-case через `pickTeacherByFio` ДО вызова сюда.
  const startsMatches: string[] = [];
  for (const [k, v] of map) {
    if (normalizeName(k).startsWith(norm)) startsMatches.push(v);
  }
  return startsMatches.length === 1 ? startsMatches[0] : null;
}

/** Парсит cgN.htm/cpN.htm: дни × 8 пар, ячейки .ur с ссылками .z1/.z2/.z3. */
function parseWeekTable(html: string, mode: 'group' | 'teacher'): ChtotibWeekDay[] {
  const flat = flattenHtml(html);
  const rowRe = /<TR[^>]*>([\s\S]*?)<\/TR>/gi;
  const days: ChtotibWeekDay[] = [];
  let currentDay: ChtotibWeekDay | null = null;

  for (const m of flat.matchAll(rowRe)) {
    const row = m[1];

    // Заголовок дня: <TD class=hd rowspan="8">18.05.2026<br>Пн-1</TD>
    const dayHdr = /<TD[^>]*rowspan="?\d+"?[^>]*>\s*(\d{2}\.\d{2}\.\d{4})[^<]*(?:<br>|\s)+([^<]+?)<\/TD>/i.exec(row);
    if (dayHdr) {
      if (currentDay) days.push(currentDay);
      currentDay = { date: dayHdr[1], weekday: dayHdr[2].trim(), slots: [] };
    }
    if (!currentDay) continue;

    // Номер пары: <TD class=hd>3</TD> (после dayHdr или просто в строке)
    // Сначала уберём только что распознанный заголовок дня, чтобы он не мешал
    // искать period:
    const stripped = dayHdr ? row.slice(dayHdr.index! + dayHdr[0].length) : row;
    const periodM = /<TD[^>]*class=hd[^>]*>\s*(\d+)\s*<\/TD>/i.exec(stripped);
    if (!periodM) continue;
    const period = Number(periodM[1]);

    // Ячейки урока: всё что class="ur"
    const lessonCells = Array.from(
      stripped.matchAll(/<TD[^>]*class="ur"[^>]*>([\s\S]*?)<\/TD>/gi),
    );
    if (lessonCells.length === 0) continue;

    const entries: ChtotibWeekEntry[] = [];
    lessonCells.forEach((lm, idx) => {
      const cellHtml = lm[0];
      const inner = lm[1];
      const colspan = /colspan="?(\d+)"?/i.exec(cellHtml)?.[1];
      const e = parseLessonCell(inner, mode);
      if (!e) return;
      // Если colspan=1 — это пара для подгруппы (idx 0 = подгруппа 1, idx 1 = подгруппа 2).
      // Если colspan=2 — общая пара для всей группы.
      if (colspan === '1') e.subgroup = (idx + 1) as 1 | 2;
      entries.push(e);
    });

    if (entries.length > 0) {
      currentDay.slots.push({ period, entries });
    }
  }
  if (currentDay) days.push(currentDay);
  return days;
}

/** Ячейка урока: z1/z2/z3 → ChtotibWeekEntry. */
function parseLessonCell(html: string, mode: 'group' | 'teacher'): ChtotibWeekEntry | null {
  const z1 = /<a[^>]*class="z1"[^>]*>([^<]+)<\/a>/i.exec(html)?.[1]?.trim();
  const z2 = /<a[^>]*class="z2"[^>]*>([^<]+)<\/a>/i.exec(html)?.[1]?.trim();
  const z3 = /<a[^>]*class="z3"[^>]*>([^<]+)<\/a>/i.exec(html)?.[1]?.trim();
  // Если все три пусты — это служебная пустая ячейка.
  if (!z1 && !z2 && !z3) return null;
  if (mode === 'group') {
    return {
      subjectOrGroup: z1 ?? '',
      teacherOrSubject: z3 ?? '',
      room: z2 ?? '',
    };
  }
  return {
    subjectOrGroup: z1 ?? '',  // группа
    teacherOrSubject: z3 ?? '', // дисциплина
    room: z2 ?? '',
  };
}
