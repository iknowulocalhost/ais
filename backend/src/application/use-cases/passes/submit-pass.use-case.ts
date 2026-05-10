import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PASS_REPOSITORY,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import { Hostel, Pass } from '../../../domain/entities/pass.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface SubmitPassInput {
  fullName: string;
  groupOrPosition: string;
  hostel: Hostel;
  ticketKey?: string | null;
  maxUserId?: string | null;
}

@Injectable()
export class SubmitPassUseCase {
  constructor(
    @Inject(PASS_REPOSITORY) private readonly passes: PassRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: SubmitPassInput): Promise<Pass> {
    if (!input.fullName.trim()) throw new BadRequestException('ФИО обязательно');
    if (!input.groupOrPosition.trim()) {
      throw new BadRequestException('Группа/должность обязательна');
    }
    const ctx = this.reqCtx.get();
    if (!ctx.actorId) throw new BadRequestException('Неаутентифицирован');

    const now = new Date();
    const pass = new Pass(
      randomUUID(),
      input.fullName.trim(),
      input.groupOrPosition.trim(),
      input.hostel,
      input.ticketKey?.trim() || null,
      input.maxUserId?.trim() || null,
      'PENDING',
      null,
      null,
      ctx.actorId,
      now,
      now,
    );
    const saved = await this.passes.create(pass);

    await this.audit.record({
      ctx,
      action: 'CREATE',
      entity: 'Pass',
      entityId: saved.id,
      newState: { fullName: saved.fullName, hostel: saved.hostel, status: saved.status },
    });

    return saved;
  }
}
