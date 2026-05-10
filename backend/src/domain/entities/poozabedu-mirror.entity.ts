/**
 * «Зеркало» сущностей из Сетевого ПОО внутри нашей АИС.
 *
 * Соблюдаем принцип минимизации (152-ФЗ): храним только то, что физически нужно
 * для UX в АИС — связь по `externalId`, ФИО для отображения, ID группы для фильтрации.
 * Паспортные данные, адреса, СНИЛС, родители НИКОГДА не копируются в нашу БД —
 * они доступны только on-demand через прокси к Сетевому ПОО для авторизованного
 * оператора, и сразу же забываются (не сохраняются между запросами).
 *
 * Сценарий «студент исчез из upstream»: ставим `isActive=false`. Жёсткое удаление
 * не делаем — на нашу запись могут ссылаться заявки на справку/пропуск.
 */

export class PoozabeduDepartment {
  constructor(
    /** Внутренний UUID АИС. */
    public readonly id: string,
    /** ID в Сетевом ПОО (стабилен между сессиями). */
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
    public gender: string | null,                 // 'Male'|'Female'|null
    public groupExternalId: number | null,
    public groupName: string | null,              // денорм для удобной выдачи списков
    public educationBasis: string | null,         // 'FederalBudget' и т.п. — нужно для отчётов
    /**
     * Средний балл из Сетевого ПОО (`gradePointAverage`). Денорм для bento-карточек
     * /my-group и фильтрации «должников». Обновляется при каждом ночном sync.
     */
    public gradePointAverage: number | null,
    public isActive: boolean,
    public syncedAt: Date,
  ) {}
}
