import { Role } from '../enums/role.enum';

/**
 * Доменная сущность User.
 * НЕ зависит от ORM и фреймворков — чистая бизнес-модель.
 */
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
