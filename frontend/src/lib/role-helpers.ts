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

/**
 * Учитель-только: TEA без административных ролей. На /dashboard такому
 * пользователю показываем учительскую сводку (своя группа + долги + посещаемость).
 */
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
