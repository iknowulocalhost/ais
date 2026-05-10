import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Not, Repository } from 'typeorm';
import {
  PoozabeduDepartment,
  PoozabeduStudent,
  PoozabeduStudentGroup,
} from '../../../domain/entities/poozabedu-mirror.entity';
import {
  PoozabeduDepartmentRepository,
  PoozabeduStudentFilter,
  PoozabeduStudentGroupRepository,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import {
  PoozabeduDepartmentOrmEntity,
  PoozabeduStudentGroupOrmEntity,
  PoozabeduStudentOrmEntity,
} from '../entities/poozabedu-mirror.orm-entity';

/**
 * Реализации зеркал. Используем TypeORM upsert по ON CONFLICT (external_id).
 * Жёсткое удаление не делается — `deactivateExcept` ставит is_active=false
 * для записей, которых больше нет в upstream.
 */

@Injectable()
export class TypeOrmPoozabeduDepartmentRepository implements PoozabeduDepartmentRepository {
  constructor(
    @InjectRepository(PoozabeduDepartmentOrmEntity)
    private readonly repo: Repository<PoozabeduDepartmentOrmEntity>,
  ) {}

  async upsertMany(items: PoozabeduDepartment[]): Promise<void> {
    if (items.length === 0) return;
    const rows = items.map(toOrmDept);
    await this.repo.upsert(rows, ['externalId']);
  }

  async deactivateExcept(externalIds: number[]): Promise<number> {
    const qb = this.repo
      .createQueryBuilder()
      .update()
      .set({ isActive: false });
    if (externalIds.length > 0) {
      qb.where({ externalId: Not(In(externalIds)) });
    }
    qb.andWhere('is_active = true');
    const r = await qb.execute();
    return r.affected ?? 0;
  }

  async listAll(): Promise<PoozabeduDepartment[]> {
    const rows = await this.repo.find({ order: { name: 'ASC' } });
    return rows.map(toDomainDept);
  }
}

@Injectable()
export class TypeOrmPoozabeduStudentGroupRepository implements PoozabeduStudentGroupRepository {
  constructor(
    @InjectRepository(PoozabeduStudentGroupOrmEntity)
    private readonly repo: Repository<PoozabeduStudentGroupOrmEntity>,
  ) {}

  async upsertMany(items: PoozabeduStudentGroup[]): Promise<void> {
    if (items.length === 0) return;
    const rows = items.map(toOrmGroup);
    await this.repo.upsert(rows, ['externalId']);
  }

  async deactivateExcept(externalIds: number[]): Promise<number> {
    const qb = this.repo.createQueryBuilder().update().set({ isActive: false });
    if (externalIds.length > 0) {
      qb.where({ externalId: Not(In(externalIds)) });
    }
    qb.andWhere('is_active = true');
    const r = await qb.execute();
    return r.affected ?? 0;
  }

  async listAll(): Promise<PoozabeduStudentGroup[]> {
    const rows = await this.repo.find({ order: { name: 'ASC' } });
    return rows.map(toDomainGroup);
  }

  async listOwnedExternalIdsByCurator(curatorExternalId: number): Promise<number[]> {
    const rows = await this.repo.find({
      where: { curatorExternalId, isActive: true },
      select: ['externalId'],
    });
    return rows.map((r) => r.externalId);
  }
}

@Injectable()
export class TypeOrmPoozabeduStudentRepository implements PoozabeduStudentRepository {
  constructor(
    @InjectRepository(PoozabeduStudentOrmEntity)
    private readonly repo: Repository<PoozabeduStudentOrmEntity>,
  ) {}

  async upsertMany(items: PoozabeduStudent[]): Promise<void> {
    if (items.length === 0) return;
    // upsert батчами по 500 — на случай больших дельт.
    const batchSize = 500;
    for (let i = 0; i < items.length; i += batchSize) {
      const slice = items.slice(i, i + batchSize).map(toOrmStudent);
      await this.repo.upsert(slice, ['externalId']);
    }
  }

  async deactivateExcept(externalIds: number[]): Promise<number> {
    const qb = this.repo.createQueryBuilder().update().set({ isActive: false });
    if (externalIds.length > 0) {
      qb.where({ externalId: Not(In(externalIds)) });
    }
    qb.andWhere('is_active = true');
    const r = await qb.execute();
    return r.affected ?? 0;
  }

  async list(filter: PoozabeduStudentFilter, limit: number, offset: number) {
    const qb = this.repo.createQueryBuilder('s');
    if (filter.isActive !== undefined) {
      qb.andWhere('s.is_active = :ia', { ia: filter.isActive });
    }
    if (filter.groupExternalId !== undefined) {
      qb.andWhere('s.group_external_id = :gid', { gid: filter.groupExternalId });
    }
    if (filter.groupExternalIdsAllowed !== undefined) {
      // Пустой массив — не показываем ничего (важно для TEA без своих групп: fail-closed).
      if (filter.groupExternalIdsAllowed.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('s.group_external_id IN (:...allowed)', {
          allowed: filter.groupExternalIdsAllowed,
        });
      }
    }
    if (filter.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('s.last_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('s.first_name ILIKE :q', { q: `%${filter.search}%` })
            .orWhere('s.middle_name ILIKE :q', { q: `%${filter.search}%` });
        }),
      );
    }
    const [rows, total] = await qb
      .orderBy('s.last_name', 'ASC')
      .addOrderBy('s.first_name', 'ASC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: rows.map(toDomainStudent), total };
  }

  async findByExternalId(externalId: number): Promise<PoozabeduStudent | null> {
    const r = await this.repo.findOne({ where: { externalId } });
    return r ? toDomainStudent(r) : null;
  }
}

// ────────── мапперы ──────────

function toDomainDept(r: PoozabeduDepartmentOrmEntity): PoozabeduDepartment {
  return new PoozabeduDepartment(
    r.id, r.externalId, r.name, r.managerExternalId,
    r.isActive, r.syncedAt,
  );
}
function toOrmDept(d: PoozabeduDepartment): Partial<PoozabeduDepartmentOrmEntity> {
  return {
    externalId: d.externalId,
    name: d.name,
    managerExternalId: d.managerExternalId,
    isActive: d.isActive,
    syncedAt: d.syncedAt,
  };
}

function toDomainGroup(r: PoozabeduStudentGroupOrmEntity): PoozabeduStudentGroup {
  return new PoozabeduStudentGroup(
    r.id, r.externalId, r.name, r.code, r.yearNumber, r.educationForm,
    r.departmentExternalId, r.curatorExternalId, r.isActive, r.syncedAt,
  );
}
function toOrmGroup(g: PoozabeduStudentGroup): Partial<PoozabeduStudentGroupOrmEntity> {
  return {
    externalId: g.externalId,
    name: g.name,
    code: g.code,
    yearNumber: g.yearNumber,
    educationForm: g.educationForm,
    departmentExternalId: g.departmentExternalId,
    curatorExternalId: g.curatorExternalId,
    isActive: g.isActive,
    syncedAt: g.syncedAt,
  };
}

function toDomainStudent(r: PoozabeduStudentOrmEntity): PoozabeduStudent {
  return new PoozabeduStudent(
    r.id, r.externalId,
    r.lastName, r.firstName, r.middleName,
    r.birthDate, r.gender,
    r.groupExternalId, r.groupName,
    r.educationBasis,
    r.gradePointAverage !== null && r.gradePointAverage !== undefined
      ? Number(r.gradePointAverage)
      : null,
    r.isActive, r.syncedAt,
  );
}
function toOrmStudent(s: PoozabeduStudent): Partial<PoozabeduStudentOrmEntity> {
  return {
    externalId: s.externalId,
    lastName: s.lastName,
    firstName: s.firstName,
    middleName: s.middleName,
    birthDate: s.birthDate,
    gender: s.gender,
    groupExternalId: s.groupExternalId,
    groupName: s.groupName,
    educationBasis: s.educationBasis,
    gradePointAverage: s.gradePointAverage !== null ? String(s.gradePointAverage) : null,
    isActive: s.isActive,
    syncedAt: s.syncedAt,
  };
}
