/**
 * Ролевая модель АИС: Студенты.
 * Коды зафиксированы: используются в JWT claims, в БД (enum) и в RBAC-гвардах.
 */
export enum Role {
  SUPERADMIN = 'SUPERADMIN', // суперадминистратор системы
  ADM = 'ADM',               // администратор
  ACC = 'ACC',               // бухгалтер
  COM = 'COM',               // приёмная комиссия
  INF = 'INF',               // информационный отдел
  TEA = 'TEA',               // классный руководитель
  ANA = 'ANA',               // аналитик
  PHO = 'PHO',               // фотограф
  STU = 'STU',               // студент
}

export const ALL_ROLES: Role[] = Object.values(Role);
