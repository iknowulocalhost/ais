import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Pass } from '../../../domain/entities/pass.entity';
import {
  PassFilter,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import { PassOrmEntity } from '../entities/pass.orm-entity';

@Injectable()
export class TypeOrmPassRepository implements PassRepository {
  constructor(
    @InjectRepository(PassOrmEntity)
    private readonly repo: Repository<PassOrmEntity>,
  ) {}

  async findById(id: string): Promise<Pass | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(p: Pass): Promise<Pass> {
    const saved = await this.repo.save(this.toOrm(p));
    return this.toDomain(saved);
  }

  async update(p: Pass): Promise<Pass> {
    const saved = await this.repo.save(this.toOrm(p));
    return this.toDomain(saved);
  }

  async list(filter: PassFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('p');
    if (filter.status) qb.andWhere('p.status = :status', { status: filter.status });
    if (filter.submitterUserId) {
      qb.andWhere('p.submitter_user_id = :uid', { uid: filter.submitterUserId });
    }
    if (filter.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('p.full_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('p.group_or_position ILIKE :q', { q: `%${filter.search}%` });
        }),
      );
    }
    if (filter.createdFrom) qb.andWhere('p.created_at >= :cf', { cf: filter.createdFrom });
    if (filter.createdTo) qb.andWhere('p.created_at < (:ct::date + INTERVAL \'1 day\')', { ct: filter.createdTo });
    const [rows, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: PassOrmEntity): Pass {
    return new Pass(
      r.id,
      r.fullName,
      r.groupOrPosition,
      r.hostel,
      r.ticketKey,
      r.maxUserId,
      r.status,
      r.statusComment,
      r.reviewerId,
      r.submitterUserId,
      r.createdAt,
      r.updatedAt,
    );
  }

  private toOrm(p: Pass): PassOrmEntity {
    const row = new PassOrmEntity();
    row.id = p.id;
    row.fullName = p.fullName;
    row.groupOrPosition = p.groupOrPosition;
    row.hostel = p.hostel;
    row.ticketKey = p.ticketKey;
    row.maxUserId = p.maxUserId;
    row.status = p.status;
    row.statusComment = p.statusComment;
    row.reviewerId = p.reviewerId;
    row.submitterUserId = p.submitterUserId;
    row.createdAt = p.createdAt;
    row.updatedAt = p.updatedAt;
    return row;
  }
}
