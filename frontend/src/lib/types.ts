/**
 * Роли — зеркалят backend (backend/src/domain/enums/role.enum.ts).
 * Держим как union string-literal, чтобы сериализация JSON совпадала 1-в-1.
 */
export type Role =
  | 'SUPERADMIN'
  | 'ADM'
  | 'ACC'
  | 'COM'
  | 'INF'
  | 'TEA'
  | 'ANA'
  | 'PHO'
  | 'STU';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: AuthUser;
}

/** Человекочитаемые подписи для навигации. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Супер-админ',
  ADM: 'Администратор',
  ACC: 'Бухгалтер',
  COM: 'Приёмная комиссия',
  INF: 'Информационный отдел',
  TEA: 'Классный руководитель',
  ANA: 'Аналитик',
  PHO: 'Фотограф',
  STU: 'Студент',
};

/** Для ролевого «главного» раздела после логина. */
export function homePathForRoles(roles: Role[]): string {
  if (roles.includes('SUPERADMIN') || roles.includes('ADM')) return '/admin/users';
  if (roles.includes('COM')) return '/applications';
  if (roles.includes('ACC')) return '/payments';
  if (roles.includes('ANA')) return '/reports';
  if (roles.includes('STU')) return '/me';
  return '/me';
}

export function hasAnyRole(user: AuthUser | null, required: Role[]): boolean {
  if (!user) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  return required.some((r) => user.roles.includes(r));
}
