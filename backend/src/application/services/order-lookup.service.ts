import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface SpecialtyMeta {
  code: string | null;
  durationMonths: number;
  aliases: string[];
  groupPrefixes: string[];
}

interface SpecialtyEntry extends SpecialtyMeta {
  canonicalName: string;
}

const SPECIALTY_CANON: Record<string, SpecialtyMeta> = {
  // 1 год 10 месяцев (22 мес.)
  'Мастер общестроительных работ': {
    code: '08.01.27',
    durationMonths: 22,
    aliases: ['МСР', 'Мастер общестроительных работ'],
    groupPrefixes: ['МСР'],
  },
  'Мастер отделочных строительных и декоративных работ': {
    code: '08.01.28',
    durationMonths: 22,
    aliases: ['МОСДР', 'Мастер отделочных строительных и декоративных работ'],
    groupPrefixes: ['МОСДР'],
  },
  'Мастер по ремонту и обслуживанию инженерных систем жилищно-коммунального хозяйства': {
    code: '08.01.29',
    durationMonths: 22,
    aliases: [
      'МЖКХ',
      'Мастер по ремонту и обслуживанию инженерных систем',
      'Мастер по ремонту и обслуживанию инженерных систем жилищно-коммунального хозяйства',
    ],
    groupPrefixes: ['МЖКХ'],
  },
  'Монтажник связи': {
    code: '11.01.05',
    durationMonths: 22,
    aliases: ['МС', 'Монтажник связи'],
    groupPrefixes: ['МС'],
  },
  'Сварщик (ручной и частично механизированной сварки (наплавки)': {
    code: '15.01.05',
    durationMonths: 22,
    aliases: ['ЭГС', 'Сварщик (ручной и частично механизированной сварки (наплавки)'],
    groupPrefixes: ['ЭГС'],
  },
  'Мастер вертикального транспорта': {
    code: '23.01.18',
    durationMonths: 22,
    aliases: ['Мастер вертикального транспорта', 'МВТ'],
    groupPrefixes: ['МВТ'],
  },

  // 2 года 10 месяцев (34 мес.)
  'Архитектура': {
    code: '07.02.01',
    durationMonths: 34,
    aliases: ['АРХ', 'Архитектура'],
    groupPrefixes: ['АРХ'],
  },
  'Монтаж и эксплуатация внутренних сантехнических устройств, кондиционирования воздуха и вентиляции': {
    code: '08.02.13',
    durationMonths: 34,
    aliases: [
      'СВК',
      'Монтаж и эксплуатация внутренних сантехнических устройств, кондиционирования воздуха и вентиляции',
    ],
    groupPrefixes: ['СВК'],
  },
  'Веб-разработка': {
    code: null,
    durationMonths: 34,
    aliases: ['Веб-разработка', 'Веб'],
    groupPrefixes: ['ВЕБ'],
  },
  'Туризм и гостеприимство': {
    code: '43.02.16',
    durationMonths: 34,
    aliases: ['Туризм и гостеприимство', 'ТиГ'],
    groupPrefixes: ['ТИГ'],
  },
  'Эксплуатация и обслуживание многоквартирного дома': {
    code: '08.02.11',
    durationMonths: 34,
    aliases: ['Эксплуатация и обслуживание многоквартирного дома', 'УМД'],
    groupPrefixes: ['УМД'],
  },

  // 3 года 10 месяцев (46 мес.)
  'Строительство и эксплуатация зданий и сооружений': {
    code: '08.02.01',
    durationMonths: 46,
    aliases: [
      'СЭЗС',
      'СЭЗС заочное',
      'Строительство и эксплуатация зданий и сооружений',
      'Строительство и эксплуатация зданий и сооружений (9 классов)',
      'Строительство и эксплуатация зданий и сооружений (11 классов)',
    ],
    groupPrefixes: ['СЭЗС'],
  },
  'Строительство и эксплуатация автомобильных дорог и аэродромов': {
    code: '08.02.05',
    durationMonths: 46,
    aliases: [
      'СД',
      'СД-25-1',
      'СДМ',
      'Строительство и эксплуатация автомобильных дорог и аэродромов',
      'Строительство и эксплуатация автомобильных дорог, аэродромов и городский путей сообщения',
    ],
    groupPrefixes: ['СД', 'СДМ'],
  },
  'Сетевое и системное администрирование': {
    code: '09.02.06',
    durationMonths: 46,
    aliases: ['СиС', 'Сетевое и системное администрирование'],
    groupPrefixes: ['СИС'],
  },
  'Инфокоммуникационные сети и системы связи': {
    code: '11.02.15',
    durationMonths: 46,
    aliases: ['ИКСиС', 'Инфокоммуникационные сети и системы связи'],
    groupPrefixes: ['ИКСИС'],
  },
  'Информационные системы и программирование (администратор)': {
    code: '09.02.07',
    durationMonths: 46,
    aliases: ['ИСиП адм', 'Информационные системы и программирование (администратор)'],
    groupPrefixes: ['ИСИПА'],
  },
  'Информационные системы и программирование (веб)': {
    code: '09.02.07',
    durationMonths: 46,
    aliases: ['ИСиП веб', 'Информационные системы и программирование (веб)'],
    groupPrefixes: ['ИСИПВ'],
  },
  'Информационные системы и программирование (программист)': {
    code: '09.02.07',
    durationMonths: 46,
    aliases: [
      'ИСиП программист',
      'Информационные системы и программирование (программист)',
      'Информационные системы и программирование: программист',
    ],
    groupPrefixes: ['ИСИП'],
  },
  'Теплоснабжение и теплотехническое оборудование': {
    code: '13.02.02',
    durationMonths: 46,
    aliases: ['ТТО', 'Теплоснабжение и теплотехническое оборудование'],
    groupPrefixes: ['ТТО'],
  },
  'Техническая эксплуатация подъемно-транспортных, строительных, дорожных машин и оборудования': {
    code: '23.02.04',
    durationMonths: 46,
    aliases: [
      'ТЭСМО',
      'Техническая эксплуатация подъемно-траеспортных, строительных, дорожных машин и оборудования (11 кл)',
      'Техническая эксплуатация подъемно-траеспортных, строительных, дорожных машин и оборудования (9 кл)',
      'Техническая эксплуатация подъемно-транспортных, строительных, дорожных машин и оборудования"(по отра',
    ],
    groupPrefixes: ['ТЭСМО', 'СДМ'],
  },
};

const ALIAS_TO_CANON = new Map<string, string>();
const PREFIX_TO_CANON = new Map<string, string>();
for (const [name, meta] of Object.entries(SPECIALTY_CANON)) {
  ALIAS_TO_CANON.set(name.toLowerCase(), name);
  for (const alias of meta.aliases) ALIAS_TO_CANON.set(alias.toLowerCase(), name);
  for (const pref of meta.groupPrefixes) PREFIX_TO_CANON.set(pref.toUpperCase(), name);
}

export interface OrderRow {
  fullName: string;
  group: string;
  specialty: string;
  orderNumber: string;
  orderDate: string;
}

interface PeremRow {
  fullName: string;          // в этом CSV — полное «Фамилия Имя Отчество»
  reason: string;            // поле «Причина»
  orderNumber: string;
  orderDate: string;
}

export interface AcademicPeriod {
  /** Начало академа, ISO yyyy-mm-dd. */
  start: string | null;
  /** Конец академа, ISO yyyy-mm-dd. */
  end: string | null;
  /** Дата приказа об академе. */
  orderDate: string | null;
  /** Номер приказа об академе. */
  orderNumber: string | null;
  /** Краткая причина: «семейным обстоятельствам». */
  reason: string;
}

export interface OrderLookupResult {
  found: boolean;
  fullName?: string;
  group?: string;
  enrollDate?: string;       // ISO yyyy-mm-dd
  orderNumber?: string;
  specialty?: {
    canonicalName: string;
    code: string | null;
    durationMonths: number;
    durationHuman: string;
  } | null;
  course?: number | null;
  gradYear?: number | null;
  academicPeriods?: AcademicPeriod[];
}

@Injectable()
export class OrderLookupService implements OnModuleInit {
  private readonly logger = new Logger(OrderLookupService.name);
  private rows: OrderRow[] = [];
  private byMask = new Map<string, OrderRow>();
  private peremByFullName = new Map<string, PeremRow[]>();

  constructor(private readonly cfg: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const dataDir = this.cfg.get<string>('CSV_DATA_DIR') ||
      path.resolve(process.cwd(), 'data');

    try {
      const text = await fs.promises.readFile(path.join(dataDir, 'order.csv'), 'utf8');
      this.rows = parseOrderCsv(text);
      for (const r of this.rows) {
        if (r.fullName) this.byMask.set(r.fullName, r);
      }
      this.logger.log(`Загружено строк приказов о зачислении: ${this.rows.length}`);
    } catch (err) {
      this.logger.warn(
        `order.csv не загружен: ${(err as Error).message}. Автозаполнение печатных форм отключено.`,
      );
    }

    try {
      const text = await fs.promises.readFile(path.join(dataDir, 'order_perem.csv'), 'utf8');
      const perem = parsePeremCsv(text);
      for (const r of perem) {
        if (!r.fullName) continue;
        const arr = this.peremByFullName.get(r.fullName) ?? [];
        arr.push(r);
        this.peremByFullName.set(r.fullName, arr);
      }
      this.logger.log(`Загружено строк приказов о переменах: ${perem.length}`);
    } catch (err) {
      this.logger.warn(
        `order_perem.csv не загружен: ${(err as Error).message}. Академы в справках не будут показаны.`,
      );
    }
  }

  lookupByFullName(fullName: string, today: Date = new Date()): OrderLookupResult {
    const mask = fioToMask(fullName);
    if (!mask) return { found: false };

    const row = this.byMask.get(mask);
    if (!row) return { found: false };

    const enroll = parseShortDate(row.orderDate);
    const canon = detectCanonicalSpecialty(row);
    const meta = canon ? SPECIALTY_CANON[canon] : null;

    const peremRows = this.peremByFullName.get(normalizeFio(fullName)) ?? [];
    const academicPeriods = extractAcademicPeriods(peremRows);

    let course: number | null = null;
    let gradYear: number | null = null;
    if (enroll && meta && meta.durationMonths > 0) {
      const startAcYear = academicStartYear(enroll);
      const currentAcYear = academicStartYear(today);
      const totalYears = Math.ceil(meta.durationMonths / 12);
      let c = currentAcYear - startAcYear + 1;
      if (c < 1) c = 1;
      if (c > totalYears) c = totalYears;
      course = c;
      gradYear = startAcYear + totalYears + academicPeriods.length;
    }

    return {
      found: true,
      fullName: row.fullName,
      group: row.group,
      enrollDate: enroll ? toIso(enroll) : undefined,
      orderNumber: row.orderNumber || undefined,
      specialty: canon && meta ? {
        canonicalName: canon,
        code: meta.code,
        durationMonths: meta.durationMonths,
        durationHuman: humanizeDurationMonths(meta.durationMonths),
      } : null,
      course,
      gradYear,
      academicPeriods,
    };
  }
}

/* ───── parsing helpers ───── */

function parseOrderCsv(text: string): OrderRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headerCells = splitLine(lines[0]);
  const idx = (name: string) => headerCells.findIndex((h) => h === name);
  const iFio = idx('ФИО');
  const iGroup = idx('Группа');
  const iSpec = idx('Специальность');
  const iOrderNo = idx('НомерПриказа');
  const iOrderDate = idx('ДатаПриказа');
  const iBlankNo = idx('НомерБланк');
  const iBlankDate = idx('ДатаБланк');

  const rows: OrderRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i]);
    if (c.length < 2) continue;
    rows.push({
      fullName: (c[iFio] ?? '').trim(),
      group: (c[iGroup] ?? '').trim(),
      specialty: (c[iSpec] ?? '').trim(),
      orderNumber: ((c[iOrderNo] ?? '') || (c[iBlankNo] ?? '')).trim(),
      orderDate: ((c[iOrderDate] ?? '') || (c[iBlankDate] ?? '')).trim(),
    });
  }
  return rows;
}

function splitLine(line: string): string[] {
  return line.split(';').map((s) => s);
}

function parsePeremCsv(text: string): PeremRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = splitLine(lines[0]);
  const idx = (name: string) => header.findIndex((h) => h === name);
  const iFio = idx('ФИО');
  const iReason = idx('Причина');
  const iOrderNo = idx('НомерПриказа');
  const iOrderDate = idx('ДатаПриказа');
  const iBlankNo = idx('НомерБланк');
  const iBlankDate = idx('ДатаБланк');

  const out: PeremRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i]);
    if (c.length < 2) continue;
    out.push({
      fullName: normalizeFio(c[iFio] ?? ''),
      reason: (c[iReason] ?? '').trim(),
      orderNumber: ((c[iOrderNo] ?? '') || (c[iBlankNo] ?? '')).trim(),
      orderDate: ((c[iOrderDate] ?? '') || (c[iBlankDate] ?? '')).trim(),
    });
  }
  return out;
}

/** «Иванов  Иван   Иванович» → «Иванов Иван Иванович». */
function normalizeFio(s: string): string {
  return (s || '').replace(/\xa0/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}

function extractAcademicPeriods(rows: PeremRow[]): AcademicPeriod[] {
  const out: AcademicPeriod[] = [];
  for (const row of rows) {
    const text = (row.reason || '').replace(/\xa0/g, ' ');
    if (!text) continue;
    if (!text.toLowerCase().includes('академ')) continue;

    let start: Date | null = null;
    let end: Date | null = null;

    const m1 = /с\s*(\d{2}\.\d{2}\.\d{4})\s*г?\.?\s*(?:по|до)\s*(\d{2}\.\d{2}\.\d{4})/i.exec(text);
    if (m1) {
      start = parseShortDate(m1[1]);
      end = parseShortDate(m1[2]);
    } else {
      const m2 = /с\s*(\d{2}\.\d{2}\.\d{4})/i.exec(text);
      if (m2) start = parseShortDate(m2[1]);
    }

    let reason = '';
    const mr = /по\s+([^.]+)$/i.exec(text);
    if (mr) reason = mr[1].trim();
    else reason = text.replace(/академическ\S*\s+отпуск/i, '').trim();

    out.push({
      start: start ? toIso(start) : null,
      end: end ? toIso(end) : null,
      orderDate: parseShortDate(row.orderDate) ? toIso(parseShortDate(row.orderDate)!) : null,
      orderNumber: row.orderNumber || null,
      reason,
    });
  }
  out.sort((a, b) => (a.start ?? '0').localeCompare(b.start ?? '0'));
  return out;
}

export function fioToMask(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const last = parts[0];
  const initials: string[] = [];
  if (parts[1]) initials.push(parts[1][0].toUpperCase() + '.');
  if (parts[2]) initials.push(parts[2][0].toUpperCase() + '.');
  return initials.length ? `${last} ${initials.join(' ')}` : last;
}

export function parseShortDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (m[3].length === 2) yy = 2000 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(yy, mm - 1, dd);
}

function academicStartYear(d: Date): number {
  return d.getMonth() + 1 >= 8 ? d.getFullYear() : d.getFullYear() - 1;
}

function detectCanonicalSpecialty(row: OrderRow): string | null {
  const rawSpec = row.specialty || '';
  if (rawSpec) {
    const lower = rawSpec.toLowerCase();
    const direct = ALIAS_TO_CANON.get(lower);
    if (direct) return direct;
    for (const [aliasLower, canon] of ALIAS_TO_CANON) {
      if (aliasLower && lower.includes(aliasLower)) return canon;
    }
  }
  const group = (row.group || '').replace(/\s+/g, '');
  if (!group) return null;
  const upper = group.toUpperCase();

  if (upper.startsWith('ИСИП')) {
    const last = upper[upper.length - 1];
    if (last === 'П') return 'Информационные системы и программирование (программист)';
    if (last === 'В') return 'Информационные системы и программирование (веб)';
    if (last === 'А') return 'Информационные системы и программирование (администратор)';
    return 'Информационные системы и программирование (программист)';
  }
  for (const [pref, canon] of PREFIX_TO_CANON) {
    if (upper.startsWith(pref)) return canon;
  }
  return null;
}

export function humanizeDurationMonths(months: number): string {
  if (!months) return '';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const out: string[] = [];
  if (years) {
    let word = 'лет';
    if (years % 10 === 1 && years % 100 !== 11) word = 'год';
    else if (years % 10 >= 2 && years % 10 <= 4 && !(years % 100 >= 12 && years % 100 <= 14)) word = 'года';
    out.push(`${years} ${word}`);
  }
  if (rem) {
    let word = 'месяцев';
    if (rem % 10 === 1 && rem % 100 !== 11) word = 'месяц';
    else if (rem % 10 >= 2 && rem % 10 <= 4 && !(rem % 100 >= 12 && rem % 100 <= 14)) word = 'месяца';
    out.push(`${rem} ${word}`);
  }
  return out.join(' ');
}

function toIso(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
