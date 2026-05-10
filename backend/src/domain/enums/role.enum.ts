/**
 * Ролевая модель АИС: Студенты.
 * Коды зафиксированы: используются в JWT claims, в БД (enum) и в RBAC-гвардах.
 */
export enum Role {
  SUPERADMIN = 'SUPERADMIN',         // суперадминистратор системы
  ADM = 'ADM',                       // администратор (технический)
  ADMINISTRATION = 'ADMINISTRATION', // администрация (директор/заместители)
  COM = 'COM',                       // учебная часть
  TEA = 'TEA',                       // преподаватели / классные руководители
  STU = 'STU',                       // студенты
}

export const ALL_ROLES: Role[] = Object.values(Role);
