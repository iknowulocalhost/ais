import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/repositories/user.repository';

/** Инкремент users.max_link_prompt_skip_count. ≥2 → дальше фронт показывает блок-модалку. */
@Injectable()
export class SkipMaxPromptUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(userId: string): Promise<{ skipCount: number }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    user.maxLinkPromptSkipCount = (user.maxLinkPromptSkipCount ?? 0) + 1;
    await this.users.update(user);
    return { skipCount: user.maxLinkPromptSkipCount };
  }
}
