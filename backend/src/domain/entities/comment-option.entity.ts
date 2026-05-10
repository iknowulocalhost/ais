/**
 * Справочник готовых комментариев для статусов пропусков и справок.
 * Используется в выпадайке при отклонении/выдаче, чтобы не печатать руками каждый раз.
 */
export class CommentOption {
  constructor(
    public readonly id: string,
    public title: string,
    public text: string,
    public isDefault: boolean,
    public readonly createdAt: Date,
  ) {}
}
