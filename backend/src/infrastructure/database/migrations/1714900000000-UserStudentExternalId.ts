import { MigrationInterface, QueryRunner } from 'typeorm';

/** users.student_external_id: связь учётки АИС со студентом из зеркала. */
export class UserStudentExternalId1714900000000 implements MigrationInterface {
  name = 'UserStudentExternalId1714900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "student_external_id" integer;
    `);
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
