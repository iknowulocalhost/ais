import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository';
import {
  STUDENT_REPOSITORY,
  StudentRepository,
} from '../../../domain/repositories/student.repository';
import {
  GROUP_REPOSITORY,
  GroupRepository,
} from '../../../domain/repositories/group.repository';
import { Student } from '../../../domain/entities/student.entity';
import { AuditService } from '../../services/audit.service';
import { NotifyService } from '../../services/notify.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface BatchEnrollInput {
  applicationIds: string[];
  groupId: string;
}

export interface BatchEnrollOutcome {
  enrolled: string[]; // ids of applications переведённых в ENROLLED
  skipped: { id: string; reason: string }[];
}

/**
 * Массовое зачисление. Принимает список заявок в статусе ACCEPTED и группу.
 * Для каждой: создаёт Student со статусом ENROLLED, привязывает к группе,
 * переводит Application → ENROLLED. Ошибки по одной заявке не ломают пакет —
 * неудачные уходят в `skipped` с причиной.
 *
 * Транзакция НЕ открывается на весь пакет осознанно: частичный прогресс лучше,
 * чем полный откат из-за единичной плохой заявки. Каждая заявка обрабатывается
 * атомарно парой (create student → update application).
 */
@Injectable()
export class BatchEnrollUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly apps: ApplicationRepository,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GROUP_REPOSITORY) private readonly groups: GroupRepository,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: BatchEnrollInput): Promise<BatchEnrollOutcome> {
    if (!input.applicationIds?.length) {
      throw new BadRequestException('Пустой список заявок');
    }
    const group = await this.groups.findById(input.groupId);
    if (!group) throw new NotFoundException('Группа не найдена');

    const ctx = this.reqCtx.get();
    const applications = await this.apps.findManyByIds(input.applicationIds);
    const foundIds = new Set(applications.map((a) => a.id));

    const outcome: BatchEnrollOutcome = { enrolled: [], skipped: [] };
    for (const id of input.applicationIds) {
      if (!foundIds.has(id)) outcome.skipped.push({ id, reason: 'не найдена' });
    }

    for (const app of applications) {
      if (app.status !== 'ACCEPTED') {
        outcome.skipped.push({ id: app.id, reason: `статус ${app.status}, ожидалось ACCEPTED` });
        continue;
      }
      try {
        const now = new Date();
        const student = new Student(
          randomUUID(),
          null,
          input.groupId,
          app.firstName,
          app.lastName,
          app.middleName,
          app.birthDate,
          'ENROLLED',
          null,
          now,
          now,
        );
        const savedStudent = await this.students.create(student);
        app.markEnrolled(savedStudent.id);
        await this.apps.update(app);

        await this.audit.record({
          ctx,
          action: 'UPDATE',
          entity: 'Application',
          entityId: app.id,
          oldState: { status: 'ACCEPTED' },
          newState: { status: 'ENROLLED', studentId: savedStudent.id, groupId: input.groupId },
        });
        await this.audit.record({
          ctx,
          action: 'CREATE',
          entity: 'Student',
          entityId: savedStudent.id,
          newState: {
            firstName: savedStudent.firstName,
            lastName: savedStudent.lastName,
            status: savedStudent.status,
            groupId: savedStudent.groupId,
          },
          meta: { fromApplicationId: app.id },
        });

        await this.notify.enqueue({
          to: app.email,
          subject: 'Поздравляем с зачислением!',
          text:
            `Здравствуйте, ${app.firstName}!\n\n` +
            `Вы зачислены на направление «${app.programCode}», группа «${group.name}».\n` +
            `Ваш личный идентификатор: ${savedStudent.id}.\n` +
            `Дальнейшие инструкции придут отдельным письмом.\n\n— АИС:Студенты`,
        });

        outcome.enrolled.push(app.id);
      } catch (err) {
        outcome.skipped.push({ id: app.id, reason: (err as Error).message });
      }
    }
    return outcome;
  }
}
