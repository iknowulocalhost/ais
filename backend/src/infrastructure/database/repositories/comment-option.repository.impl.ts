import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CommentOption } from '../../../domain/entities/comment-option.entity';
import { CommentOptionRepository } from '../../../domain/repositories/comment-option.repository';
import { CommentOptionOrmEntity } from '../entities/comment-option.orm-entity';

@Injectable()
export class TypeOrmCommentOptionRepository implements CommentOptionRepository {
  constructor(
    @InjectRepository(CommentOptionOrmEntity)
    private readonly repo: Repository<CommentOptionOrmEntity>,
  ) {}

  async findById(id: string): Promise<CommentOption | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async list(): Promise<CommentOption[]> {
    const rows = await this.repo.find({ order: { isDefault: 'DESC', title: 'ASC' } });
    return rows.map((r) => this.toDomain(r));
  }

  async create(c: CommentOption): Promise<CommentOption> {
    const saved = await this.repo.save(this.toOrm(c));
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async resetDefaultsExcept(id: string): Promise<void> {
    await this.repo.update({ id: Not(id) }, { isDefault: false });
  }

  private toDomain(r: CommentOptionOrmEntity): CommentOption {
    return new CommentOption(r.id, r.title, r.text, r.isDefault, r.createdAt);
  }

  private toOrm(c: CommentOption): CommentOptionOrmEntity {
    const row = new CommentOptionOrmEntity();
    row.id = c.id;
    row.title = c.title;
    row.text = c.text;
    row.isDefault = c.isDefault;
    row.createdAt = c.createdAt;
    return row;
  }
}
