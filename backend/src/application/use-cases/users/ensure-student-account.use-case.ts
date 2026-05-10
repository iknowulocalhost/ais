import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import {
  PASSWORD_HASHER,
  PasswordHasher,
} from '../../../domain/services/password-hasher';
import { PasswordGenerator } from '../../services/password-generator';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';
import { User } from '../../../domain/entities/user.entity';
import { Role } from '../../../domain/enums/role.enum';

export interface EnsureStudentAccountResult {
  /** Если `true` — это новая учётка, и `password` свежесозданный (показываем). */
  created: boolean;
  userId: string;
  email: string;
  /** Plaintext-пароль возвращается ровно один раз — только для свежесозданных. */
  password: string | null;
}

/**
 * Создаёт пользовательскую учётку для студента из зеркала Сетевого ПОО,
 * если её ещё нет. Идемпотентна: повторный вызов вернёт ту же учётку без
 * нового пароля.
 *
 * Логин формируется в виде `<lastname>.<firstname>@chtotib.ru`
 * (транслитерация по ГОСТ, в нижнем регистре). Если такой логин уже занят
 * (полный однофамилец), добавляем суффикс `.<external_id>` — это гарантирует
 * уникальность и сохраняет осмысленность. Реальная почта студента, если она
 * появится, прописывается отдельно через профиль.
 */
@Injectable()
export class EnsureStudentAccountUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly generator: PasswordGenerator,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(studentExternalId: number): Promise<EnsureStudentAccountResult> {
    const ctx = this.reqCtx.get();

    // Уже привязан — возвращаем без нового пароля.
    const existing = await this.users.findByStudentExternalId(studentExternalId);
    if (existing) {
      return { created: false, userId: existing.id, email: existing.email, password: null };
    }

    const student = await this.students.findByExternalId(studentExternalId);
    if (!student) throw new NotFoundException('Студент не найден в зеркале');

    const email = await this.buildLogin(student.lastName, student.firstName, studentExternalId);
    const password = this.generator.generate(12);
    const passwordHash = await this.hasher.hash(password);
    const now = new Date();

    const user = new User(
      randomUUID(),
      email,
      passwordHash,
      student.firstName,
      student.lastName,
      student.middleName,
      [Role.STU],
      true,
      now,
      now,
      null,
      null,
      studentExternalId,
    );
    const saved = await this.users.create(user);

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'User',
      entityId: saved.id,
      newState: {
        email: saved.email,
        roles: saved.roles,
        studentExternalId,
      },
    });

    return { created: true, userId: saved.id, email: saved.email, password };
  }

  /**
   * Строит логин студента: `<lastname>.<firstname>@chtotib.ru` (транслит).
   * Если такой логин уже занят однофамильцем, добавляет суффикс с external_id.
   */
  private async buildLogin(
    lastName: string,
    firstName: string,
    externalId: number,
  ): Promise<string> {
    const ln = translit(lastName);
    const fn = translit(firstName);
    const base = `${ln}.${fn}`;
    const candidate = `${base}@chtotib.ru`;
    const conflict = await this.users.findByEmail(candidate);
    if (!conflict) return candidate;
    // Однофамилец-полный тёзка — добавляем числовой суффикс. Это ловит даже
    // редкий случай совпадения двух студентов с одинаковыми ФИО в разных группах.
    return `${base}.${externalId}@chtotib.ru`;
  }
}

/** ГОСТ-подобная транслитерация русских букв в латиницу, нижний регистр. */
function translit(s: string): string {
  const m: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
    я: 'ya',
  };
  return s
    .toLowerCase()
    .trim()
    .split('')
    .map((ch) => (ch in m ? m[ch] : /[a-z0-9]/.test(ch) ? ch : ''))
    .join('')
    // схлопываем повторные дефисы/точки на всякий случай
    .replace(/[^a-z0-9]+/g, '');
}
