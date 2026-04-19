import { Inject, Injectable } from '@nestjs/common';
import {
  APPLICATION_REPOSITORY,
  ApplicationFilter,
  ApplicationRepository,
} from '../../../domain/repositories/application.repository';
import { Application } from '../../../domain/entities/application.entity';

@Injectable()
export class ListApplicationsUseCase {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly apps: ApplicationRepository,
  ) {}

  async execute(
    filter: ApplicationFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: Application[]; total: number }> {
    return this.apps.list(filter, Math.min(limit || 50, 200), Math.max(offset || 0, 0));
  }
}
