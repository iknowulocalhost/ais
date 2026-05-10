import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import { EnsureStudentAccountUseCase } from './ensure-student-account.use-case';

export interface BulkAccountRow {
  studentExternalId: number;
  fullName: string;
  groupName: string | null;
  email: string;
  /** Plaintext-пароль есть только у свежесозданных учёток. У уже существующих — null. */
  password: string | null;
  created: boolean;
}

/**
 * Массовое создание учёток студентов целой группы. Идемпотентно:
 * существующие учётки не трогает, новым выдаёт сгенерированный пароль.
 *
 * Возвращает список — каждый элемент содержит ФИО, логин и (для новых) пароль,
 * чтобы куратор мог распечатать ведомость и раздать студентам.
 */
@Injectable()
export class BulkEnsureGroupAccountsUseCase {
  constructor(
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    private readonly ensureOne: EnsureStudentAccountUseCase,
  ) {}

  async execute(groupExternalId: number): Promise<BulkAccountRow[]> {
    const { items } = await this.students.list(
      { isActive: true, groupExternalId },
      500,
      0,
    );
    const out: BulkAccountRow[] = [];
    for (const s of items) {
      const r = await this.ensureOne.execute(s.externalId);
      out.push({
        studentExternalId: s.externalId,
        fullName: `${s.lastName} ${s.firstName}${s.middleName ? ` ${s.middleName}` : ''}`,
        groupName: s.groupName,
        email: r.email,
        password: r.password,
        created: r.created,
      });
    }
    out.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
    return out;
  }
}
