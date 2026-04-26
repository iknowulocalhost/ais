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

/**
 * Все роли после логина попадают на единую «Сводку» (/dashboard),
 * которая сама подстраивается под роль. До версии 0.1 была ролевая «домашняя» —
 * отказались в пользу общей опорной точки (DESIGN.md §5).
 */
export function homePathForRoles(_roles: Role[]): string {
  return '/dashboard';
}

export function hasAnyRole(user: AuthUser | null, required: Role[]): boolean {
  if (!user) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  return required.some((r) => user.roles.includes(r));
}
