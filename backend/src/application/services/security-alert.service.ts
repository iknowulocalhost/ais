import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../domain/repositories/audit-log.repository';
import { AuditLog } from '../../domain/entities/audit-log.entity';

export type AlertKind =
  | 'permission_probing'  // много 401/403 от одного субъекта/IP
  | 'brute_force'         // много неудачных логинов с одного IP
  | 'mass_read'           // много READ_SENSITIVE от одного актора
  | 'scraping';           // высокий объём HTTP-запросов с одного IP

interface RuleHit {
  kind: AlertKind;
  key: string;
  threshold: number;
  windowSec: number;
  meta: Record<string, unknown>;
}

interface Observation {
  action: string;
  status?: number;
  path?: string;
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
export class SecurityAlertService {
  private readonly logger = new Logger(SecurityAlertService.name);
  private readonly windows = new Map<string, number[]>();
  private readonly lastFired = new Map<string, number>();

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository,
  ) {}

  observe(o: Observation): void {
    const now = Date.now();
    const denied = o.status === 401 || o.status === 403;
    const isLogin = (o.path ?? '').startsWith('/auth/login');

    const hits: RuleHit[] = [];

    // brute_force — неудачные логины с одного IP
    if (denied && isLogin && o.ipAddress) {
      const key = `brute:${o.ipAddress}`;
      if (this.bump(key, now, 60_000) >= 5) {
        hits.push({
          kind: 'brute_force', key, threshold: 5, windowSec: 60,
          meta: { ipAddress: o.ipAddress, userAgent: o.userAgent },
        });
      }
    }

    // permission_probing — 401/403 не на /auth/login
    if (denied && !isLogin) {
      const subject = o.actorId ?? o.ipAddress;
      if (subject) {
        const key = `denied:${subject}`;
        if (this.bump(key, now, 60_000) >= 5) {
          hits.push({
            kind: 'permission_probing', key, threshold: 5, windowSec: 60,
            meta: { subject, byActor: !!o.actorId, ipAddress: o.ipAddress, lastPath: o.path },
          });
        }
      }
    }

    // mass_read — массовое READ_SENSITIVE от одного актора
    if (o.action === 'READ_SENSITIVE' && o.actorId) {
      const key = `read:${o.actorId}`;
      if (this.bump(key, now, 5 * 60_000) >= 30) {
        hits.push({
          kind: 'mass_read', key, threshold: 30, windowSec: 300,
          meta: { actorId: o.actorId, ipAddress: o.ipAddress },
        });
      }
    }

    // scraping — высокий объём HTTP с одного IP
    if (o.action === 'HTTP_REQUEST' && o.ipAddress) {
      const key = `http:${o.ipAddress}`;
      if (this.bump(key, now, 60_000) >= 200) {
        hits.push({
          kind: 'scraping', key, threshold: 200, windowSec: 60,
          meta: { ipAddress: o.ipAddress, userAgent: o.userAgent },
        });
      }
    }

    for (const hit of hits) this.fire(hit, o, now);
  }

  /** Добавляет timestamp в окно, обрезает старые, возвращает текущий счётчик. */
  private bump(key: string, now: number, windowMs: number): number {
    const arr = this.windows.get(key) ?? [];
    const cutoff = now - windowMs;
    let i = 0;
    while (i < arr.length && arr[i] < cutoff) i++;
    const fresh = i > 0 ? arr.slice(i) : arr;
    fresh.push(now);
    this.windows.set(key, fresh);
    return fresh.length;
  }

  private fire(hit: RuleHit, o: Observation, now: number): void {
    const last = this.lastFired.get(hit.key) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    this.lastFired.set(hit.key, now);

    const entry = new AuditLog(
      new Date(now),
      o.actorId,
      'SECURITY_ALERT' as AuditLog['action'],
      'SecurityAlert',
      randomUUID(),
      o.ipAddress,
      o.userAgent,
      null,
      null,
      {
        kind: hit.kind,
        key: hit.key,
        threshold: hit.threshold,
        windowSec: hit.windowSec,
        ...hit.meta,
      },
    );
    this.repo.append(entry).catch((err) => {
      this.logger.error('Failed to persist security alert', err as Error);
    });
    this.logger.warn(`SECURITY_ALERT ${hit.kind} key=${hit.key}`);
  }
}
