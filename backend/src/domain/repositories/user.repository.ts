import { User } from '../entities/user.entity';

/**
 * Порт (interface) репозитория пользователей.
 * Реализация — в infrastructure/database/repositories.
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(user: User): Promise<User>;
  abstract update(user: User): Promise<User>;
  abstract delete(id: string): Promise<void>;
  abstract list(limit: number, offset: number): Promise<{ items: User[]; total: number }>;
  /** Поиск аккаунта, связанного со студентом из зеркала Сетевого ПОО. */
  abstract findByStudentExternalId(externalId: number): Promise<User | null>;
  /**
   * Подгоняет users.is_active под poozabedu_student.is_active по связи
   * `student_external_id`. Используется ночным sync'ом, чтобы при отчислении
   * (студент стал `isActive=false`) автоматически отключался и его аккаунт.
   * Возвращает {disabled, enabled} — сколько строк было выключено/возвращено.
   */
  abstract syncActiveFromStudentMirror(): Promise<{ disabled: number; enabled: number }>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
