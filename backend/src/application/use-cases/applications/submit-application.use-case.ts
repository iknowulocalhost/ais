import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  APPLICATION_REPOSITORY,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository';
import { Application } from '../../../domain/entities/application.entity';
import { AuditService } from '../../services/audit.service';
import { NotifyService } from '../../services/notify.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface SubmitApplicationInput {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  birthDate: string; // ISO
  email: string;
  phone?: string | null;
  programCode: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Публичная подача заявки (без авторизации). actorId в аудите = null.
 * После сохранения — асинхронно шлём подтверждение на email абитуриента.
 */
@Injectable()
export class SubmitApplicationUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly apps: ApplicationRepository,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: SubmitApplicationInput): Promise<Application> {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new BadRequestException('Некорректный email');
    if (!input.firstName.trim() || !input.lastName.trim()) {
      throw new BadRequestException('ФИО обязательно');
    }
    if (!input.programCode.trim()) {
      throw new BadRequestException('Код направления обязателен');
    }

    const now = new Date();
    const app = new Application(
      randomUUID(),
      input.firstName.trim(),
      input.lastName.trim(),
      input.middleName?.trim() || null,
      new Date(input.birthDate),
      email,
      input.phone?.trim() || null,
      input.programCode.trim(),
      'SUBMITTED',
      null,
      null,
      null,
      now,
      now,
    );
    const saved = await this.apps.create(app);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'Application',
      entityId: saved.id,
      newState: {
        email: saved.email,
        programCode: saved.programCode,
        status: saved.status,
      },
    });

    await this.notify.enqueue({
      to: saved.email,
      subject: 'Ваша заявка принята — АИС: Студенты',
      text:
        `Здравствуйте, ${saved.firstName}!\n\n` +
        `Ваша заявка на направление «${saved.programCode}» получена и зарегистрирована ` +
        `под номером ${saved.id}.\n` +
        `Мы уведомим вас о решении приёмной комиссии.\n\n` +
        `— АИС:Студенты`,
    });

    return saved;
  }
}
