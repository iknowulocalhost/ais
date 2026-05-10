import { Inject, Injectable } from '@nestjs/common';
import {
  COMMENT_OPTION_REPOSITORY,
  CommentOptionRepository,
} from '../../../domain/repositories/comment-option.repository';

@Injectable()
export class DeleteCommentOptionUseCase {
  constructor(
    @Inject(COMMENT_OPTION_REPOSITORY) private readonly repo: CommentOptionRepository,
  ) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
