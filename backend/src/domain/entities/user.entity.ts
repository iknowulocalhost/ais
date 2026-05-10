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
    /**
     * ID сотрудника в Сетевом ПОО (poo.zabedu.ru). Заполняется для пользователей
     * с ролью TEA, чтобы понимать, чьим классным руководителем они являются.
     * Без этой связи TEA не сможет получить доступ ни к одной группе.
     */
    public netschoolEmployeeId: number | null = null,
    /**
     * external_id студента из зеркала Сетевого ПОО (`poozabedu_student.external_id`).
     * Заполняется для учёток студентов, которые админ выдаёт через досье или массовое
     * создание паролей. Позволяет за O(1) находить аккаунт студента по ID карточки.
     */
    public studentExternalId: number | null = null,
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
