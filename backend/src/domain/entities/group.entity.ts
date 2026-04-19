/**
 * Учебная группа.
 */
export class Group {
  constructor(
    public readonly id: string,
    public code: string,          // например "ИС-21-1"
    public name: string,
    public year: number,          // год поступления
    public curatorId: string | null, // FK → users.id (роль TEA)
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}
