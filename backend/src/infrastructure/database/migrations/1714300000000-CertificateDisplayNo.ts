import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Человекочитаемый номер справки («С-N»).
 *
 * Реализация: отдельная PostgreSQL sequence + колонка `display_no` с дефолтом
 * `nextval(...)`. UUID-первичный ключ остаётся, но в печатные формы и UI выводится
 * именно display_no — оператор видит «С-42» вместо обрезанного UUID.
 *
 * Идемпотентность: создание sequence и колонки обёрнуто в IF NOT EXISTS,
 * чтобы безопасно повторно прогонять на уже инициализированной БД.
 */
export class CertificateDisplayNo1714300000000 implements MigrationInterface {
  name = 'CertificateDisplayNo1714300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SEQUENCE IF NOT EXISTS "certificate_request_no_seq" START 1;`);
    await q.query(`
      ALTER TABLE "certificate_requests"
      ADD COLUMN IF NOT EXISTS "display_no" integer
        NOT NULL DEFAULT nextval('certificate_request_no_seq');
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_cert_display_no"
      ON "certificate_requests" ("display_no");
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ux_cert_display_no";`);
    await q.query(`ALTER TABLE "certificate_requests" DROP COLUMN IF EXISTS "display_no";`);
    await q.query(`DROP SEQUENCE IF EXISTS "certificate_request_no_seq";`);
  }
}
