import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../../domain/entities/audit-log.entity';
import { AuditLogRepository } from '../../../domain/repositories/audit-log.repository';
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
