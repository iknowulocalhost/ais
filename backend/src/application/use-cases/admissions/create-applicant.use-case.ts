import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Applicant,
  ApplicantPayload,
  ApplicantStatus,
} from '../../../domain/entities/applicant.entity';
import {
  APPLICANT_REPOSITORY,
  ApplicantRepository,
} from '../../../domain/repositories/applicant.repository';

export interface CreateApplicantInput {
  payload: ApplicantPayload;
  status: ApplicantStatus; // 'DRAFT' | 'SUBMITTED'
  createdById: string;
}

@Injectable()
export class CreateApplicantUseCase {
  constructor(
    @Inject(APPLICANT_REPOSITORY) private readonly repo: ApplicantRepository,
  ) {}

  async execute(input: CreateApplicantInput): Promise<Applicant> {
    const now = new Date();
    const a = new Applicant(
      randomUUID(),
      input.status,
      input.payload,
      input.createdById,
      now,
      now,
    );
    return this.repo.create(a);
  }
}
