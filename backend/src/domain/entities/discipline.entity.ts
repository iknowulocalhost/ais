export class Discipline {
  constructor(
    public readonly id: string,
    public code: string,             // например «ИНФТ.01», уникален
    public name: string,             // «Информатика и ИКТ»
    public totalHours: number,       // общий объём часов по ФГОС
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}
