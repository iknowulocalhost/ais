import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, InvalidCredentialsError } from 'ldapts';

export interface LdapProfile {
  samAccountName: string;
  dn: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  email: string;
  groups: string[];
}

interface LdapConfig {
  enabled: boolean;
  uri: string;
  port: number;
  connectTimeoutMs: number;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  userFilter: string;
  userAttributes: string[];
  adminGroupDn: string | null;
  defaultEmailDomain: string;
  staffGroup: string | null;
  organizerGroup: string | null;
  excludeOus: string[];
}

@Injectable()
export class LdapClientService {
  private readonly logger = new Logger(LdapClientService.name);
  private readonly cfg: LdapConfig;

  constructor(config: ConfigService) {
    this.cfg = {
      enabled: !!config.get<string>('LDAP_SERVER_URI'),
      uri: normalizeUri(
        config.get<string>('LDAP_SERVER_URI') ?? '',
        Number(config.get<string>('LDAP_PORT') ?? '389'),
      ),
      port: Number(config.get<string>('LDAP_PORT') ?? '389'),
      connectTimeoutMs: Number(config.get<string>('LDAP_CONNECT_TIMEOUT_MS') ?? '5000'),
      bindDn: config.get<string>('LDAP_BIND_DN') ?? '',
      bindPassword: config.get<string>('LDAP_BIND_PASSWORD') ?? '',
      searchBase: config.get<string>('LDAP_SEARCH_BASE') ?? '',
      userFilter:
        config.get<string>('LDAP_USER_FILTER') ??
        '(&(objectClass=user)(sAMAccountName={}))',
      userAttributes: parseList(
        config.get<string>('LDAP_USER_ATTRIBUTES'),
        ['givenName', 'sn', 'middleName', 'memberOf', 'mail', 'sAMAccountName'],
      ),
      adminGroupDn: config.get<string>('LDAP_ADMIN_GROUP_DN') || null,
      defaultEmailDomain: config.get<string>('LDAP_DEFAULT_EMAIL_DOMAIN') ?? 'local',
      staffGroup: config.get<string>('LDAP_STAFF_GROUP') || null,
      organizerGroup: config.get<string>('LDAP_ORGANIZER_GROUP') || null,
      excludeOus: parseList(config.get<string>('LDAP_USER_EXCLUDE_OUS'), [])
        .map((s) => s.toLowerCase()),
    };
  }

  isEnabled(): boolean {
    return this.cfg.enabled && !!this.cfg.bindDn && !!this.cfg.searchBase;
  }

  private buildBindCandidates(raw: string): string[] {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return [];
    const isUpn = trimmed.includes('@');
    const isDn = /=/i.test(trimmed) && /,/i.test(trimmed);
    const isDomainBackslash = trimmed.includes('\\');

    const candidates: string[] = [trimmed];
    const domain = this.cfg.defaultEmailDomain;

    if (isDomainBackslash && !trimmed.startsWith('CN=') && !isUpn) {
      const userPart = trimmed.split('\\').pop()?.trim();
      if (userPart && domain) candidates.push(`${userPart}@${domain}`);
      if (userPart && this.cfg.searchBase) {
        candidates.push(`CN=${userPart},CN=Users,${this.cfg.searchBase}`);
      }
    } else if (!isUpn && !isDn && !isDomainBackslash) {
      if (domain) candidates.push(`${trimmed}@${domain}`);
      if (this.cfg.searchBase) {
        candidates.push(`CN=${trimmed},CN=Users,${this.cfg.searchBase}`);
      }
    }
    return candidates;
  }

  private isExcludedDn(dn: string): boolean {
    if (this.cfg.excludeOus.length === 0) return false;
    const lower = dn.toLowerCase();
    return this.cfg.excludeOus.some((ou) => lower.includes(ou));
  }

  getConfig(): LdapConfig {
    return this.cfg;
  }

  async authenticate(samAccountName: string, password: string): Promise<LdapProfile | null> {
    if (!this.isEnabled()) return null;
    if (!samAccountName || !password) return null;

    const sanitized = escapeLdapFilterValue(samAccountName);
    if (!sanitized) return null;
    const filter = this.cfg.userFilter.replace('{}', sanitized);

    const serviceClient = new Client({
      url: this.cfg.uri,
      timeout: this.cfg.connectTimeoutMs,
      connectTimeout: this.cfg.connectTimeoutMs,
    });

    const bindCandidates = this.buildBindCandidates(this.cfg.bindDn);

    try {
      let bound = false;
      let lastErr: Error | null = null;
      for (const candidate of bindCandidates) {
        try {
          await serviceClient.bind(candidate, this.cfg.bindPassword);
          bound = true;
          break;
        } catch (e) {
          lastErr = e as Error;
          if (!/data\s+52e/i.test((e as Error).message)) break;
        }
      }
      if (!bound) {
        const e = lastErr ?? new Error('unknown');
        const reason = describeAdBindError((e as Error).message);
        this.logger.error(
          `LDAP: сервисный bind не прошёл (${reason}). ` +
          `Пробовали форматы: ${bindCandidates.join(' | ')}. ` +
          `Проверьте LDAP_BIND_DN / LDAP_BIND_PASSWORD в .env. ` +
          `Поддерживаемые форматы: UPN «user@domain.local», ` +
          `DOMAIN\\user (NetBIOS, латиницей), ` +
          `полный DN «CN=...,DC=domain,DC=local».`,
        );
        return null;
      }

      const { searchEntries } = await serviceClient.search(this.cfg.searchBase, {
        scope: 'sub',
        filter,
        attributes: this.cfg.userAttributes,
        sizeLimit: 1,
      });
      if (searchEntries.length === 0) {
        // не разделяем «нет пользователя» и «неверный пароль» — защита от перебора
        this.logger.warn(`LDAP: authentication failed`);
        return null;
      }
      const entry = searchEntries[0];
      const userDn = String(entry.dn);

      if (this.isExcludedDn(userDn)) {
        this.logger.warn(`LDAP: authentication failed`);
        return null;
      }

      const userClient = new Client({
        url: this.cfg.uri,
        timeout: this.cfg.connectTimeoutMs,
        connectTimeout: this.cfg.connectTimeoutMs,
      });
      try {
        await userClient.bind(userDn, password);
      } catch (e) {
        if (e instanceof InvalidCredentialsError) {
          this.logger.warn(`LDAP: authentication failed`);
        } else {
          this.logger.warn(`LDAP: bind error (${(e as Error).message})`);
        }
        return null;
      } finally {
        await userClient.unbind().catch(() => undefined);
      }

      const attrEmail = pickString(entry.mail);
      const samFromAd = pickString(entry.sAMAccountName) ?? samAccountName;
      return {
        samAccountName: samFromAd,
        dn: userDn,
        firstName: pickString(entry.givenName),
        lastName: pickString(entry.sn),
        middleName: pickString(entry.middleName),
        email: attrEmail || `${samFromAd}@${this.cfg.defaultEmailDomain}`,
        groups: pickList(entry.memberOf),
      };
    } catch (e) {
      this.logger.warn(`LDAP: search error (${(e as Error).message.slice(0, 200)})`);
      return null;
    } finally {
      await serviceClient.unbind().catch(() => undefined);
    }
  }
}

/* ─────────── helpers ─────────── */

function describeAdBindError(rawMessage: string): string {
  const m = /data\s+([0-9a-f]+)/i.exec(rawMessage);
  const code = m ? m[1].toLowerCase() : null;
  switch (code) {
    case '525':  return 'пользователь сервисной учётки не найден';
    case '52e':  return 'неверные учётные данные (логин или пароль)';
    case '530':  return 'вход в это время суток запрещён политикой AD';
    case '531':  return 'вход с этой рабочей станции запрещён';
    case '532':  return 'срок действия пароля истёк';
    case '533':  return 'учётная запись отключена';
    case '701':  return 'учётная запись просрочена';
    case '773':  return 'требуется смена пароля при следующем входе';
    case '775':  return 'учётная запись заблокирована';
    default:     return rawMessage.replace(/\s+/g, ' ').slice(0, 200);
  }
}

function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*() ]/g, (ch) => {
    switch (ch) {
      case '\\': return '\\5c';
      case '*':  return '\\2a';
      case '(':  return '\\28';
      case ')':  return '\\29';
      case ' ': return '\\00';
      default: return ch;
    }
  });
}

function normalizeUri(rawUri: string, port: number): string {
  if (!rawUri) return '';
  if (/^ldaps?:\/\/[^/]+:\d+/i.test(rawUri)) return rawUri;
  const hostPart = rawUri.replace(/\/$/, '');
  return `${hostPart}:${port}`;
}

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function pickString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0].trim() || null;
  if (Buffer.isBuffer(v)) return v.toString('utf8').trim() || null;
  return null;
}

function pickList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') return v ? [v] : [];
  return [];
}
