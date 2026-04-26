import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Applicant,
  ApplicantPayload,
} from '../../../domain/entities/applicant.entity';
import {
  ApplicantFilter,
  ApplicantRepository,
} from '../../../domain/repositories/applicant.repository';
import { ApplicantOrmEntity } from '../entities/applicant.orm-entity';
import { ApplicantCipherService } from '../../security/applicant-cipher.service';

@Injectable()
export class TypeOrmApplicantRepository implements ApplicantRepository {
  constructor(
    @InjectRepository(ApplicantOrmEntity)
    private readonly repo: Repository<ApplicantOrmEntity>,
    private readonly cipher: ApplicantCipherService,
  ) {}

  async findById(id: string): Promise<Applicant | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(a: Applicant): Promise<Applicant> {
    const saved = await this.repo.save(this.toOrm(a));
    return this.toDomain(saved);
  }

  async update(a: Applicant): Promise<Applicant> {
    const saved = await this.repo.save(this.toOrm(a));
    return this.toDomain(saved);
  }

  async list(filter: ApplicantFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('a');
    if (filter.status) qb.andWhere('a.status = :status', { status: filter.status });
    if (filter.createdById) qb.andWhere('a.created_by_id = :uid', { uid: filter.createdById });
    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: ApplicantOrmEntity): Applicant {
    const json = this.cipher.decrypt(r.payloadCipher);
    const payload = JSON.parse(json) as ApplicantPayload;
    return new Applicant(
      r.id,
      r.status,
      payload,
      r.createdById,
      r.createdAt,
      r.updatedAt,
    );
  }

  private toOrm(a: Applicant): ApplicantOrmEntity {
    const e = new ApplicantOrmEntity();
    e.id = a.id;
    e.status = a.status;
    e.payloadCipher = this.cipher.encrypt(JSON.stringify(a.payload));
    e.createdById = a.createdById;
    e.createdAt = a.createdAt;
    e.updatedAt = a.updatedAt;
    return e;
  }
}
