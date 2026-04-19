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
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
