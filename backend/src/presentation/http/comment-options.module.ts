import { Module } from '@nestjs/common';
import { CommentOptionsController } from './controllers/comment-options.controller';
import { ListCommentOptionsUseCase } from '../../application/use-cases/comment-options/list-comment-options.use-case';
import { CreateCommentOptionUseCase } from '../../application/use-cases/comment-options/create-comment-option.use-case';
import { DeleteCommentOptionUseCase } from '../../application/use-cases/comment-options/delete-comment-option.use-case';

@Module({
  controllers: [CommentOptionsController],
  providers: [
    ListCommentOptionsUseCase,
    CreateCommentOptionUseCase,
    DeleteCommentOptionUseCase,
  ],
})
export class CommentOptionsModule {}
