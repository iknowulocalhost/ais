import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Удаление модуля платежей. Таблица была создана в DocsPayReports1713200000000.
 * down() пуст: восстанавливать таблицу нет смысла без всех связанных артефактов.
 */
export class DropPayments1714100000000 implements MigrationInterface {
  name = 'DropPayments1714100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "payments";`);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Намеренно пусто.
  }
}
