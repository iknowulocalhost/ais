import { Applicant, ApplicantStatus } from '../entities/applicant.entity';

export interface ApplicantFilter {
  status?: ApplicantStatus;
  createdById?: string;
}

export abstract class ApplicantRepository {
  abstract findById(id: string): Promise<Applicant | null>;
  abstract create(a: Applicant): Promise<Applicant>;
  abstract update(a: Applicant): Promise<Applicant>;
  abstract list(
    filter: ApplicantFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: Applicant[]; total: number }>;
}

export const APPLICANT_REPOSITORY = Symbol('APPLICANT_REPOSITORY');
