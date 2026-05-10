import { Inject, Injectable } from '@nestjs/common';
import {
  PASS_REPOSITORY,
  PassFilter,
  PassRepository,
} from '../../../domain/repositories/pass.repository';
import { Pass } from '../../../domain/entities/pass.entity';

@Injectable()
export class ListPassesUseCase {
  constructor(
    @Inject(PASS_REPOSITORY) private readonly passes: PassRepository,
  ) {}

  async execute(
    filter: PassFilter,
    limit: number,
    offset: number,
  ): Promise<{ items: Pass[]; total: number }> {
    return this.passes.list(filter, Math.min(limit || 50, 200), Math.max(offset || 0, 0));
  }
}
