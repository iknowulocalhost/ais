export class PoozabeduDepartment {
  constructor(
    public readonly id: string,
    public readonly externalId: number,
    public name: string,
    public managerExternalId: number | null,
    public isActive: boolean,
    public syncedAt: Date,
  ) {}
}

export class PoozabeduStudentGroup {
  constructor(
    public readonly id: string,
    public readonly externalId: number,
    public name: string,
    public code: string | null,
    public yearNumber: number | null,
    public educationForm: string | null,
    public departmentExternalId: number | null,
    public curatorExternalId: number | null,
    public isActive: boolean,
    public syncedAt: Date,
  ) {}
}

export class PoozabeduStudent {
  constructor(
    public readonly id: string,
    public readonly externalId: number,
    public lastName: string,
    public firstName: string,
    public middleName: string | null,
    public birthDate: Date | null,
    public gender: string | null,
    public groupExternalId: number | null,
    public groupName: string | null,
    public educationBasis: string | null,
    /** Средний балл из Сетевого ПОО (`gradePointAverage`). */
    public gradePointAverage: number | null,
    public isActive: boolean,
    public syncedAt: Date,
  ) {}
}
