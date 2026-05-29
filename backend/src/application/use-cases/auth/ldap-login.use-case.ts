import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';
import { LdapClientService, LdapProfile } from '../../../infrastructure/external/ldap/ldap-client.service';

/** LDAP-логин: AD-bind + upsert локальной учётки + маппинг групп → ролей. */
@Injectable()
export class LdapLoginUseCase {
  private readonly logger = new Logger(LdapLoginUseCase.name);

  constructor(
    private readonly ldap: LdapClientService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  isEnabled(): boolean {
    return this.ldap.isEnabled();
  }

  /** Возвращает профиль AD или null. */
  async tryAuthenticate(samAccountName: string, password: string): Promise<LdapProfile | null> {
    return this.ldap.authenticate(samAccountName, password);
  }

  /** Upsert локальной учётки АИС из LDAP-профиля. */
  async upsertFromLdap(profile: LdapProfile): Promise<User> {
    let user = await this.users.findBySamAccountName(profile.samAccountName);
    if (!user) user = await this.users.findByEmail(profile.email);

    const roles = this.mapGroupsToRoles(profile.groups);
    const now = new Date();

    if (!user) {
      const placeholderHash = `$argon2id$ldap-managed$${randomUUID()}`;
      const created = new User(
        randomUUID(),
        profile.email.toLowerCase().trim(),
        placeholderHash,
        profile.firstName ?? profile.samAccountName,
        profile.lastName ?? '',
        profile.middleName,
        roles.length > 0 ? roles : [Role.TEA],
        true,
        now,
        now,
        null,
        null,
        null,
        profile.samAccountName,
      );
      this.logger.log(`LDAP: created user ${created.email} (sAM=${profile.samAccountName}) roles=[${created.roles.join(',')}]`);
      return this.users.create(created);
    }

    // Существующего обновляем — синхронизируем имя, email, роли, привязку к AD.
    user.firstName = profile.firstName ?? user.firstName;
    user.lastName = profile.lastName ?? user.lastName;
    user.middleName = profile.middleName ?? user.middleName;
    // Email перетираем только если он не задан был ранее или мы сами его
    // генерировали из домена (вида sam@chtotib.local). Не перетираем
    // настоящие пользовательские email'ы, которые админ мог поправить руками.
    if (!user.email || user.email.endsWith(`@${this.ldap.getConfig().defaultEmailDomain}`)) {
      user.email = profile.email.toLowerCase().trim();
    }
    user.samAccountName = profile.samAccountName;
    if (roles.length > 0) user.roles = mergeRoles(user.roles, roles);
    user.isActive = true;
    user.updatedAt = now;
    return this.users.update(user);
  }

  /** AD groups → Role[]. LDAP_ADMIN_GROUP_DN → SUPERADMIN; LDAP_STAFF_GROUP → COM; LDAP_ORGANIZER_GROUP → ADMINISTRATION. */
  private mapGroupsToRoles(groups: string[]): Role[] {
    const cfg = this.ldap.getConfig();
    const out = new Set<Role>();

    for (const dn of groups) {
      if (cfg.adminGroupDn && eqIgnoreCase(dn, cfg.adminGroupDn)) {
        out.add(Role.SUPERADMIN);
      }
      const cn = extractCn(dn);
      if (!cn) continue;
      if (cfg.staffGroup && eqIgnoreCase(cn, cfg.staffGroup)) {
        out.add(Role.COM);
      }
      if (cfg.organizerGroup && eqIgnoreCase(cn, cfg.organizerGroup)) {
        out.add(Role.ADMINISTRATION);
      }
    }

    return [...out];
  }
}

function eqIgnoreCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** «CN=Администраторы домена,CN=Users,DC=…» → «Администраторы домена». */
function extractCn(dn: string): string | null {
  const m = /^cn=([^,]+)/i.exec(dn.trim());
  return m ? m[1].trim() : null;
}

/** Объединение ролей: SUPERADMIN/TEA из existing сохраняются. */
function mergeRoles(existing: Role[], fromLdap: Role[]): Role[] {
  const set = new Set<Role>(fromLdap);
  if (existing.includes(Role.SUPERADMIN)) set.add(Role.SUPERADMIN);
  if (existing.includes(Role.TEA)) set.add(Role.TEA);
  return [...set];
}
