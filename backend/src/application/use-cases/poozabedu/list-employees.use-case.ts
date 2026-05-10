import { Injectable } from '@nestjs/common';
import { PoozabeduApiClient } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.client';
import { PzaEmployee } from '../../../infrastructure/external/poozabeduapi/poozabeduapi.types';

/**
 * Список сотрудников Сетевого ПОО для админских форм (привязка TEA-аккаунта).
 * Тонкий прокси — каждый вызов идёт в upstream. Аудита нет: справочник без ПДн,
 * нужен только ID + ФИО + должность.
 */
@Injectable()
export class ListEmployeesUseCase {
  constructor(private readonly api: PoozabeduApiClient) {}

  async execute(): Promise<PzaEmployee[]> {
    return this.api.withSession(() => this.api.listAllEmployees());
  }
}
