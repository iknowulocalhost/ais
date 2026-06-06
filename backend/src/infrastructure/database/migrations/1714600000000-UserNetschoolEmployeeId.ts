import { MigrationInterface, QueryRunner } from 'typeorm';

/** users.netschool_employee_id: id сотрудника Сетевого ПОО (для RBAC TEA). */
export class UserNetschoolEmployeeId1714600000000 implements MigrationInterface {
  name = 'UserNetschoolEmployeeId1714600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "netschool_employee_id" integer;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "ix_users_netschool_employee"
      ON "users" ("netschool_employee_id");
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_users_netschool_employee";`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "netschool_employee_id";`);
  }
}
