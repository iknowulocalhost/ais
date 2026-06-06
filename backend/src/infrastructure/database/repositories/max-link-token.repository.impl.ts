import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  MaxLinkToken,
  MaxLinkTokenRepository,
} from '../../../domain/repositories/max-link-token.repository';
import { MaxLinkTokenOrmEntity } from '../entities/max-link-token.orm-entity';

@Injectable()
export class TypeOrmMaxLinkTokenRepository implements MaxLinkTokenRepository {
  constructor(
    @InjectRepository(MaxLinkTokenOrmEntity)
    private readonly repo: Repository<MaxLinkTokenOrmEntity>,
  ) {}

  async create(token: MaxLinkToken): Promise<void> {
    await this.repo.save({
      token: token.token,
      userId: token.userId,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
      usedAt: token.usedAt,
    });
  }

  async findByToken(token: string): Promise<MaxLinkToken | null> {
    const row = await this.repo.findOne({ where: { token } });
    return row ?? null;
  }

  async markUsed(token: string): Promise<void> {
    await this.repo.update({ token }, { usedAt: new Date() });
  }

  async deleteExpiredForUser(userId: string): Promise<number> {
    // Удаляем всё, что просрочено или уже использовано — чтобы не копить мусор.
    const r = await this.repo
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('(expires_at < NOW() OR used_at IS NOT NULL)')
      .execute();
    return r.affected ?? 0;
  }
}
