import { CommentOption } from '../entities/comment-option.entity';

export abstract class CommentOptionRepository {
  abstract findById(id: string): Promise<CommentOption | null>;
  abstract list(): Promise<CommentOption[]>;
  abstract create(c: CommentOption): Promise<CommentOption>;
  abstract delete(id: string): Promise<void>;
  /** Сбрасывает флаг is_default у всех остальных записей. */
  abstract resetDefaultsExcept(id: string): Promise<void>;
}

export const COMMENT_OPTION_REPOSITORY = Symbol('COMMENT_OPTION_REPOSITORY');
