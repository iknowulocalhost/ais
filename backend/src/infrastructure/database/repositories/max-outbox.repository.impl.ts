import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  MaxOutboxItem,
  MaxOutboxRepository,
} from '../../../domain/repositories/max-outbox.repository';
import { MaxOutboxOrmEntity } from '../entities/max-outbox.orm-entity';

@Injectable()
export class TypeOrmMaxOutboxRepository implements MaxOutboxRepository {
  constructor(
    @InjectRepository(MaxOutboxOrmEntity)
    private readonly repo: Repository<MaxOutboxOrmEntity>,
  ) {}

  async enqueue(input: { userId: string | null; maxChatId: string; text: string }): Promise<string> {
    const row = await this.repo.save({
      userId: input.userId,
      maxChatId: input.maxChatId,
      text: input.text,
      deliveredAt: null,
    });
    return String(row.id);
  }

  async fetchPending(afterId: string, limit: number): Promise<MaxOutboxItem[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.delivered_at IS NULL')
      .andWhere('o.id > :afterId', { afterId })
      .orderBy('o.id', 'ASC')
      .limit(Math.min(Math.max(limit, 1), 200))
      .getMany();
    return rows.map((r) => ({
      id: String(r.id),
      userId: r.userId,
      maxChatId: r.maxChatId,
      text: r.text,
      createdAt: r.createdAt,
    }));
  }

  async markDelivered(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const r = await this.repo
      .createQueryBuilder()
      .update()
      .set({ deliveredAt: () => 'NOW()' })
      .where({ id: In(ids) })
      .andWhere('delivered_at IS NULL')
      .execute();
    return r.affected ?? 0;
  }

  async purgeOlderThan(days: number): Promise<number> {
    const r = await this.repo
      .createQueryBuilder()
      .delete()
      .where('delivered_at IS NOT NULL')
      .andWhere(`delivered_at < NOW() - INTERVAL '${Math.max(1, days)} days'`)
      .execute();
    return r.affected ?? 0;
  }
}
