import { Application, ApplicationStatus } from '../entities/application.entity';

export interface ApplicationFilter {
  status?: ApplicationStatus;
  programCode?: string;
  search?: string; // по ФИО/email
}

export abstract class ApplicationRepository {
  abstract findById(id: string): Promise<Application | null>;
  abstract findManyByIds(ids: string[]): Promise<Application[]>;
  abstract create(app: Application): Promise<Application>;
  abstract update(app: Application): Promise<Application>;
  abstract list(
    filter: ApplicationFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: Application[]; total: number }>;
}

export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');
