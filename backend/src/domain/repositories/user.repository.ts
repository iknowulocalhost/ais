import { User } from '../entities/user.entity';
import { Role } from '../enums/role.enum';

export interface UserListFilter {
  search?: string;
  role?: Role;
}

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(user: User): Promise<User>;
  abstract update(user: User): Promise<User>;
  abstract delete(id: string): Promise<void>;
  abstract list(
    limit: number,
    offset: number,
    filter?: UserListFilter,
  ): Promise<{ items: User[]; total: number }>;
  /** Поиск аккаунта, связанного со студентом из зеркала Сетевого ПОО. */
  abstract findByStudentExternalId(externalId: number): Promise<User | null>;
  /** Поиск по доменному логину AD (case-insensitive). */
  abstract findBySamAccountName(samAccountName: string): Promise<User | null>;
  /** Поиск по chat_id в MAX (мессенджер). */
  abstract findByMaxChatId(chatId: string): Promise<User | null>;
  /** Подгоняет users.is_active под poozabedu_student.is_active. */
  abstract syncActiveFromStudentMirror(): Promise<{ disabled: number; enabled: number }>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
