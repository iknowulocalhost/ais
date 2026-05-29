import { MigrationInterface, QueryRunner } from 'typeorm';

/** users.sam_account_name + partial unique index по LOWER(). */
export class UserSamAccountName1715000000000 implements MigrationInterface {
  name = 'UserSamAccountName1715000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "sam_account_name" varchar(64);
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_sam_account_name"
      ON "users" (LOWER("sam_account_name"))
      WHERE "sam_account_name" IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ux_users_sam_account_name";`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "sam_account_name";`);
  }
}
