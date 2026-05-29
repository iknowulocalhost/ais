export class CommentOption {
  constructor(
    public readonly id: string,
    public title: string,
    public text: string,
    public isDefault: boolean,
    public readonly createdAt: Date,
  ) {}
}
