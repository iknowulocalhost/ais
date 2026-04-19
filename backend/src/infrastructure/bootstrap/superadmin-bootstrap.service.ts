import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/user.repository';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../domain/services/password-hasher';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/enums/role.enum';

/**
 * Bootstrap-сервис: при старте, если в БД нет пользователей,
 * создаёт SUPERADMIN из переменных окружения.
 * Без этого некому было бы создать первого пользователя (UsersController требует ADM).
 */
@Injectable()
export class SuperadminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperadminBootstrapService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.cfg.get<string>('SUPERADMIN_EMAIL');
    const password = this.cfg.get<string>('SUPERADMIN_PASSWORD');
    if (!email || !password) return;

    const existing = await this.users.findByEmail(email);
    if (existing) return;

    const now = new Date();
    const user = new User(
      randomUUID(),
      email.toLowerCase().trim(),
      await this.hasher.hash(password),
      'Super',
      'Admin',
      null,
      [Role.SUPERADMIN],
      true,
      now,
      now,
      null,
    );
    await this.users.create(user);
    this.logger.warn(`SUPERADMIN создан: ${email}. Смените пароль при первом входе.`);
  }
}
