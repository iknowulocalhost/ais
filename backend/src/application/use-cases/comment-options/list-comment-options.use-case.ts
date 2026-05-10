import { Inject, Injectable } from '@nestjs/common';
import {
  COMMENT_OPTION_REPOSITORY,
  CommentOptionRepository,
} from '../../../domain/repositories/comment-option.repository';
import { CommentOption } from '../../../domain/entities/comment-option.entity';

@Injectable()
export class ListCommentOptionsUseCase {
  constructor(
    @Inject(COMMENT_OPTION_REPOSITORY) private readonly repo: CommentOptionRepository,
  ) {}

  execute(): Promise<CommentOption[]> {
    return this.repo.list();
  }
}
