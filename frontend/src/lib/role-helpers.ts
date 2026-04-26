import type { AuthUser } from './types';

/**
 * Студент-только: единственная роль — STU. Любая дополнительная роль
 * (TEA, ADM и т.д.) → пользователь считается «сотрудником» и получает
 * полный административный шелл.
 */
export function isStudentOnly(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.length === 1 && user.roles[0] === 'STU';
}
