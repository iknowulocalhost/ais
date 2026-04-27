import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import {
  AuditFilter,
  AuditLogRepository,
} from '../../../domain/repositories/audit-log.repository';
import { AuditLogOrmEntity } from '../entities/audit-log.orm-entity';
import { randomUUID } from 'crypto';

@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(
    @InjectRepository(AuditLogOrmEntity)
    private readonly repo: Repository<AuditLogOrmEntity>,
  ) {}

  async append(entry: AuditLog): Promise<void> {
    const row = new AuditLogOrmEntity();
    row.id = randomUUID();
    row.ts = entry.ts;
    row.actorId = entry.actorId;
    row.action = entry.action;
    row.entity = entry.entity;
    row.entityId = entry.entityId;
    row.ipAddress = entry.ipAddress;
    row.userAgent = entry.userAgent;
    row.oldState = entry.oldState;
    row.newState = entry.newState;
    row.meta = entry.meta;
    // save() совместим с strict-типизацией JSONB-колонок (Record<string, unknown> | null),
    // в отличие от insert(), где _QueryDeepPartialEntity отвергает объектные поля.
    await this.repo.save(row);
  }

  async findByEntity(entity: string, entityId: string, limit = 100): Promise<AuditLog[]> {
    const rows = await this.repo.find({
      where: { entity, entityId },
      order: { ts: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    const rows = await this.repo.find({
      where: { actorId },
      order: { ts: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }

  async find(
    filter: AuditFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.ts', 'DESC');

    if (filter.from) qb.andWhere('a.ts >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('a.ts <= :to', { to: filter.to });
    if (filter.actorId) qb.andWhere('a.actor_id = :actorId', { actorId: filter.actorId });
    if (filter.action) qb.andWhere('a.action = :action', { action: filter.action });
    if (filter.entity) qb.andWhere('a.entity = :entity', { entity: filter.entity });
    if (filter.entityId) qb.andWhere('a.entity_id = :entityId', { entityId: filter.entityId });
    if (filter.search) {
      qb.andWhere(
        '(a.entity ILIKE :s OR a.action ILIKE :s OR a.entity_id ILIKE :s OR CAST(a.meta AS text) ILIKE :s)',
        { s: `%${filter.search}%` },
      );
    }

    const [rows, total] = await qb.take(limit).skip(offset).getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: AuditLogOrmEntity): AuditLog {
    return new AuditLog(
      r.ts,
      r.actorId,
      r.action as AuditLog['action'],
      r.entity,
      r.entityId,
      r.ipAddress,
      r.userAgent,
      r.oldState,
      r.newState,
      r.meta,
    );
  }
}
