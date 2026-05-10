import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Привязка пользователя АИС к студенту из зеркала Сетевого ПОО.
 *
 * Сопоставление `users.id` ↔ `poozabedu_student.external_id` нужно, чтобы:
 *  - администратор мог сгенерировать/сбросить пароль конкретному студенту прямо
 *    из досье (`/dossier/{externalId}`), не зная внутреннего UUID учётки;
 *  - бытсрая выдача аккаунтов целой группе формировала по одному `User` на
 *    каждого студента из зеркала.
 *
 * Заполняется при создании учётки студента; позволяет null для исторических
 * учёток, пока миграция не накатилась.
 */
export class UserStudentExternalId1714900000000 implements MigrationInterface {
  name = 'UserStudentExternalId1714900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "student_external_id" integer;
    `);
    // Уникальность одной связи на одного студента — иначе будут плодиться
    // случайные дубликаты при повторных «массовых созданиях».
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_student_external_id"
      ON "users" ("student_external_id")
      WHERE "student_external_id" IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ux_users_student_external_id";`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "student_external_id";`);
  }
}
