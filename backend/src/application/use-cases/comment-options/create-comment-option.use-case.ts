import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  COMMENT_OPTION_REPOSITORY,
  CommentOptionRepository,
} from '../../../domain/repositories/comment-option.repository';
import { CommentOption } from '../../../domain/entities/comment-option.entity';

export interface CreateCommentOptionInput {
  title: string;
  text: string;
  isDefault?: boolean;
}

@Injectable()
export class CreateCommentOptionUseCase {
  constructor(
    @Inject(COMMENT_OPTION_REPOSITORY) private readonly repo: CommentOptionRepository,
  ) {}

  async execute(input: CreateCommentOptionInput): Promise<CommentOption> {
    const c = new CommentOption(
      randomUUID(),
      input.title.trim(),
      input.text.trim(),
      !!input.isDefault,
      new Date(),
    );
    const saved = await this.repo.create(c);
    if (saved.isDefault) {
      await this.repo.resetDefaultsExcept(saved.id);
    }
    return saved;
  }
}
