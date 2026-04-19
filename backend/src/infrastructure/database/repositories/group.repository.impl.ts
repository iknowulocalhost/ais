import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../../../domain/entities/group.entity';
import { GroupRepository } from '../../../domain/repositories/group.repository';
import { GroupOrmEntity } from '../entities/group.orm-entity';

@Injectable()
export class TypeOrmGroupRepository implements GroupRepository {
  constructor(
    @InjectRepository(GroupOrmEntity) private readonly repo: Repository<GroupOrmEntity>,
  ) {}

  async findById(id: string): Promise<Group | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async findByCode(code: string): Promise<Group | null> {
    const r = await this.repo.findOne({ where: { code } });
    return r ? this.toDomain(r) : null;
  }

  async create(g: Group): Promise<Group> {
    const saved = await this.repo.save(this.toOrm(g));
    return this.toDomain(saved);
  }

  async update(g: Group): Promise<Group> {
    const saved = await this.repo.save(this.toOrm(g));
    return this.toDomain(saved);
  }

  async list(limit: number, offset: number): Promise<Group[]> {
    const rows = await this.repo.find({ take: limit, skip: offset, order: { code: 'ASC' } });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(r: GroupOrmEntity): Group {
    return new Group(r.id, r.code, r.name, r.year, r.curatorId, r.createdAt, r.updatedAt);
  }

  private toOrm(g: Group): GroupOrmEntity {
    const row = new GroupOrmEntity();
    row.id = g.id;
    row.code = g.code;
    row.name = g.name;
    row.year = g.year;
    row.curatorId = g.curatorId;
    row.createdAt = g.createdAt;
    row.updatedAt = g.updatedAt;
    return row;
  }
}
