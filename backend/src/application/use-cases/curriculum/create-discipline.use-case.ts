import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DISCIPLINE_REPOSITORY,
  DisciplineRepository,
} from '../../../domain/repositories/discipline.repository';
import { Discipline } from '../../../domain/entities/discipline.entity';
import { AuditService } from '../../services/audit.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface CreateDisciplineInput {
  code: string;
  name: string;
  totalHours: number;
}

@Injectable()
export class CreateDisciplineUseCase {
  constructor(
    @Inject(DISCIPLINE_REPOSITORY) private readonly disciplines: DisciplineRepository,
    private readonly audit: AuditService,
    private readonly reqCtx: RequestContext,
  ) {}

  async execute(input: CreateDisciplineInput): Promise<Discipline> {
    const existing = await this.disciplines.findByCode(input.code);
    if (existing) throw new BadRequestException(`Дисциплина с кодом «${input.code}» уже существует`);

    const now = new Date();
    const d = new Discipline(randomUUID(), input.code, input.name, input.totalHours, now, now);
    const saved = await this.disciplines.create(d);

    await this.audit.record({
      ctx: this.reqCtx.get(),
      action: 'CREATE',
      entity: 'Discipline',
      entityId: saved.id,
      newState: { code: saved.code, name: saved.name, totalHours: saved.totalHours },
    });
    return saved;
  }
}
