import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CertificateRequest } from '../../../domain/entities/certificate-request.entity';
import {
  CertificateRequestFilter,
  CertificateRequestRepository,
} from '../../../domain/repositories/certificate-request.repository';
import { CertificateRequestOrmEntity } from '../entities/certificate-request.orm-entity';

@Injectable()
export class TypeOrmCertificateRequestRepository
  implements CertificateRequestRepository
{
  constructor(
    @InjectRepository(CertificateRequestOrmEntity)
    private readonly repo: Repository<CertificateRequestOrmEntity>,
  ) {}

  async findById(id: string): Promise<CertificateRequest | null> {
    const r = await this.repo.findOne({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async create(c: CertificateRequest): Promise<CertificateRequest> {
    const saved = await this.repo.save(this.toOrm(c));
    return this.toDomain(saved);
  }

  async update(c: CertificateRequest): Promise<CertificateRequest> {
    const saved = await this.repo.save(this.toOrm(c));
    return this.toDomain(saved);
  }

  async list(filter: CertificateRequestFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('c');
    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    if (filter.certType) qb.andWhere('c.cert_type = :ct', { ct: filter.certType });
    if (filter.submitterUserId) {
      qb.andWhere('c.submitter_user_id = :uid', { uid: filter.submitterUserId });
    }
    if (filter.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('c.full_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('c.group_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('c.email ILIKE :q', { q: `%${filter.search}%` });
        }),
      );
    }
    if (filter.createdFrom) qb.andWhere('c.created_at >= :cf', { cf: filter.createdFrom });
    if (filter.createdTo) qb.andWhere('c.created_at < (:ct::date + INTERVAL \'1 day\')', { ct: filter.createdTo });
    const [rows, total] = await qb
      .orderBy('c.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private toDomain(r: CertificateRequestOrmEntity): CertificateRequest {
    return new CertificateRequest(
      r.id,
      r.displayNo ?? null,
      r.certType,
      r.fullName,
      r.birthDate,
      r.groupName,
      r.targetOrg,
      r.phone,
      r.email,
      r.comment,
      r.periodFrom,
      r.periodTo,
      r.status,
      r.statusComment,
      r.reviewerId,
      r.maxUserId,
      r.submitterUserId,
      r.fullNameDat,
      r.createdAt,
      r.updatedAt,
    );
  }

  private toOrm(c: CertificateRequest): CertificateRequestOrmEntity {
    const row = new CertificateRequestOrmEntity();
    row.id = c.id;
    row.certType = c.certType;
    row.fullName = c.fullName;
    row.birthDate = c.birthDate;
    row.groupName = c.groupName;
    row.targetOrg = c.targetOrg;
    row.phone = c.phone;
    row.email = c.email;
    row.comment = c.comment;
    row.periodFrom = c.periodFrom;
    row.periodTo = c.periodTo;
    row.status = c.status;
    row.statusComment = c.statusComment;
    row.reviewerId = c.reviewerId;
    row.maxUserId = c.maxUserId;
    row.submitterUserId = c.submitterUserId;
    row.fullNameDat = c.fullNameDat;
    row.createdAt = c.createdAt;
    row.updatedAt = c.updatedAt;
    return row;
  }
}
