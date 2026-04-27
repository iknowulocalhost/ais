import { Controller, Get, Inject, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../../../domain/enums/role.enum';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '../../../domain/repositories/audit-log.repository';
import { UserOrmEntity } from '../../../infrastructure/database/entities/user.orm-entity';
import { AuditQueryDto } from '../dto/audit.dto';

/**
 * Журнал аудита. Доступ — только SUPERADMIN.
 * (RolesGuard всегда пропускает SUPERADMIN; пустой список ролей здесь
 * означает «никому больше», т.к. SUPERADMIN всё равно проходит.)
 */
@Controller('audit')
@Roles(Role.SUPERADMIN)
export class AuditController {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly repo: AuditLogRepository,
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  @Get()
  async list(@Query() q: AuditQueryDto) {
    const res = await this.repo.find(
      {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        actorId: q.actorId,
        action: q.action,
        entity: q.entity,
        entityId: q.entityId,
        search: q.search,
      },
      q.limit ?? 100,
      q.offset ?? 0,
    );

    // Подтянуть отображаемое имя/email акторов одним запросом — для удобства аналитика.
    const actorIds = Array.from(
      new Set(res.items.map((e) => e.actorId).filter((x): x is string => !!x)),
    );
    const actors = actorIds.length
      ? await this.users.find({
          where: { id: In(actorIds) },
          select: ['id', 'email', 'firstName', 'lastName'],
        })
      : [];
    const actorMap = new Map(
      actors.map((u) => [
        u.id,
        {
          email: u.email,
          name: `${u.lastName} ${u.firstName?.[0] ? u.firstName[0] + '.' : ''}`.trim(),
        },
      ]),
    );

    return {
      total: res.total,
      items: res.items.map((e) => ({
        ts: e.ts,
        actorId: e.actorId,
        actor: e.actorId ? actorMap.get(e.actorId) ?? null : null,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        meta: e.meta,
      })),
    };
  }
}
