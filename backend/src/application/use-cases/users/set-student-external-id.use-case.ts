import { BadRequestException, Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';
import {
  POOZABEDU_STUDENT_REPOSITORY,
  PoozabeduStudentRepository,
} from '../../../domain/repositories/poozabedu-mirror.repository';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

/** Ручная привязка users.student_external_id ↔ poozabedu_student. */
@Injectable()
export class SetUserStudentExternalIdUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(POOZABEDU_STUDENT_REPOSITORY)
    private readonly students: PoozabeduStudentRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(userId: string, studentExternalId: number | null): Promise<{ ok: true }> {
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (studentExternalId !== null) {
      if (!Number.isInteger(studentExternalId) || studentExternalId <= 0) {
        throw new BadRequestException('studentExternalId должен быть положительным целым или null');
      }
      const student = await this.students.findByExternalId(studentExternalId);
      if (!student) {
        throw new BadRequestException(`Студент #${studentExternalId} не найден в зеркале Сетевого ПОО`);
      }
      const occupied = await this.users.findByStudentExternalId(studentExternalId);
      if (occupied && occupied.id !== user.id) {
        throw new ConflictException(
          `Студент #${studentExternalId} уже привязан к другой учётной записи (${occupied.email})`,
        );
      }
    }

    const oldValue = user.studentExternalId;
    user.studentExternalId = studentExternalId;
    user.updatedAt = new Date();
    await this.users.update(user);

    await this.audit.record({
      ctx,
      action: 'ROLE_CHANGE',
      entity: 'User',
      entityId: user.id,
      oldState: { studentExternalId: oldValue },
      newState: { studentExternalId },
    });

    return { ok: true };
  }
}
