import { Role } from '../enums/role.enum';

export class User {
  constructor(
    public readonly id: string,
    public email: string,
    public passwordHash: string,
    public firstName: string,
    public lastName: string,
    public middleName: string | null,
    public roles: Role[],
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public lastLoginAt: Date | null = null,
    /** ID сотрудника в Сетевом ПОО (для роли TEA — связь с группами, где он куратор). */
    public netschoolEmployeeId: number | null = null,
    /** external_id студента из зеркала Сетевого ПОО. */
    public studentExternalId: number | null = null,
    /** Доменный логин в AD (sAMAccountName). */
    public samAccountName: string | null = null,
    /** chat_id в MAX — целевой адрес уведомлений, если задан. */
    public maxChatId: string | null = null,
  ) {}

  hasRole(role: Role): boolean {
    return this.roles.includes(role);
  }

  hasAnyRole(roles: Role[]): boolean {
    return roles.some((r) => this.roles.includes(r));
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  recordLogin(): void {
    this.lastLoginAt = new Date();
  }
}
