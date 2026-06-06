import type { AuthUser } from './types';

/** STU без дополнительных ролей. */
export function isStudentOnly(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.length === 1 && user.roles[0] === 'STU';
}

/** TEA без административных ролей. */
export function isTeacherOnly(user: AuthUser | null): boolean {
  if (!user) return false;
  if (
    user.roles.includes('SUPERADMIN') ||
    user.roles.includes('ADM') ||
    user.roles.includes('ADMINISTRATION') ||
    user.roles.includes('COM')
  ) return false;
  return user.roles.includes('TEA');
}
