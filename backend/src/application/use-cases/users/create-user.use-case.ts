import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../../domain/services/password-hasher';
import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';
import { AuditService, AuditContext } from '../../services/audit.service';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  roles: Role[];
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
  ) {}

  async execute(input: CreateUserInput, ctx: AuditContext): Promise<User> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const now = new Date();
    const passwordHash = await this.hasher.hash(input.password);

    const user = new User(
      randomUUID(),
      input.email.toLowerCase().trim(),
      passwordHash,
      input.firstName,
      input.lastName,
      input.middleName ?? null,
      input.roles.length > 0 ? input.roles : [Role.STU],
      true,
      now,
      now,
      null,
    );

    const saved = await this.users.create(user);

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'User',
      entityId: saved.id,
      oldState: null,
      newState: {
        email: saved.email,
        firstName: saved.firstName,
        lastName: saved.lastName,
        roles: saved.roles,
        isActive: saved.isActive,
        // passwordHash НЕ попадает в аудит.
      },
    });

    return saved;
  }
}
