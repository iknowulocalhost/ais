export type Role =
  | 'SUPERADMIN'
  | 'ADM'
  | 'ADMINISTRATION'
  | 'COM'
  | 'TEA'
  | 'STU';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  netschoolEmployeeId?: number | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: AuthUser;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Супер-админ',
  ADM: 'Администратор',
  ADMINISTRATION: 'Администрация',
  COM: 'Учебная часть',
  TEA: 'Преподаватель',
  STU: 'Студент',
};

export function homePathForRoles(_roles: Role[]): string {
  return '/dashboard';
}

export function hasAnyRole(user: AuthUser | null, required: Role[]): boolean {
  if (!user) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  return required.some((r) => user.roles.includes(r));
}
