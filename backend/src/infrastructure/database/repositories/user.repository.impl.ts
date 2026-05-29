import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../domain/entities/user.entity';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { UserOrmEntity } from '../entities/user.orm-entity';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    return row ? this.toDomain(row) : null;
  }

  async create(user: User): Promise<User> {
    const row = this.toOrm(user);
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async update(user: User): Promise<User> {
    const row = this.toOrm(user);
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async list(
    limit: number,
    offset: number,
    filter?: { search?: string; role?: string },
  ): Promise<{ items: User[]; total: number }> {
    const qb = this.repo.createQueryBuilder('u');
    if (filter?.role) {
      // Postgres-специфика: `roles` это `enum[]`, проверяем содержание через `=ANY`.
      qb.andWhere(':role = ANY(u.roles)', { role: filter.role });
    }
    if (filter?.search && filter.search.trim().length >= 2) {
      const q = `%${filter.search.trim()}%`;
      qb.andWhere(
        '(u.email ILIKE :q OR u.last_name ILIKE :q OR u.first_name ILIKE :q OR u.middle_name ILIKE :q)',
        { q },
      );
    }
    const [rows, total] = await qb
      .orderBy('u.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: UserOrmEntity): User {
    return new User(
      r.id,
      r.email,
      r.passwordHash,
      r.firstName,
      r.lastName,
      r.middleName,
      r.roles,
      r.isActive,
      r.createdAt,
      r.updatedAt,
      r.lastLoginAt,
      r.netschoolEmployeeId,
      r.studentExternalId,
      r.samAccountName,
      r.maxChatId,
    );
  }

  async findByStudentExternalId(externalId: number): Promise<User | null> {
    const row = await this.repo.findOne({ where: { studentExternalId: externalId } });
    return row ? this.toDomain(row) : null;
  }

  async findBySamAccountName(samAccountName: string): Promise<User | null> {
    const row = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.sam_account_name) = LOWER(:sam)', { sam: samAccountName })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async syncActiveFromStudentMirror(): Promise<{ disabled: number; enabled: number }> {
    // Дёшево и без лишних путешествий: два прицельных UPDATE'а через JOIN на
    // зеркало студентов. Postgres поддерживает USING-форму DELETE/UPDATE.
    const disabledRes = await this.repo.manager.query(`
      UPDATE "users" u
      SET "is_active" = false, "updated_at" = NOW()
      FROM "poozabedu_student" s
      WHERE u."student_external_id" IS NOT NULL
        AND u."student_external_id" = s."external_id"
        AND s."is_active" = false
        AND u."is_active" = true
    `);
    const enabledRes = await this.repo.manager.query(`
      UPDATE "users" u
      SET "is_active" = true, "updated_at" = NOW()
      FROM "poozabedu_student" s
      WHERE u."student_external_id" IS NOT NULL
        AND u."student_external_id" = s."external_id"
        AND s."is_active" = true
        AND u."is_active" = false
    `);
    // pg-driver возвращает [rows, count] для UPDATE. У TypeORM `query` —
    // `[rowsAffected]` второй элемент или null; нормализуем.
    const disabled = Array.isArray(disabledRes) && typeof disabledRes[1] === 'number' ? disabledRes[1] : 0;
    const enabled = Array.isArray(enabledRes) && typeof enabledRes[1] === 'number' ? enabledRes[1] : 0;
    return { disabled, enabled };
  }

  private toOrm(u: User): UserOrmEntity {
    const row = new UserOrmEntity();
    row.id = u.id;
    row.email = u.email;
    row.passwordHash = u.passwordHash;
    row.firstName = u.firstName;
    row.lastName = u.lastName;
    row.middleName = u.middleName;
    row.roles = u.roles;
    row.isActive = u.isActive;
    row.createdAt = u.createdAt;
    row.updatedAt = u.updatedAt;
    row.lastLoginAt = u.lastLoginAt;
    row.netschoolEmployeeId = u.netschoolEmployeeId;
    row.studentExternalId = u.studentExternalId;
    row.samAccountName = u.samAccountName;
    row.maxChatId = u.maxChatId;
    return row;
  }

  async findByMaxChatId(chatId: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { maxChatId: chatId } });
    return row ? this.toDomain(row) : null;
  }
}
