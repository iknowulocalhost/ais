import { MigrationInterface, QueryRunner } from 'typeorm';

/** Enum users.roles → 6 значений. ACC/INF/PHO→ADM, ANA→ADMINISTRATION. */
export class RolesRefactor1714800000000 implements MigrationInterface {
  name = 'RolesRefactor1714800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "users_roles_enum_new" AS ENUM (
          'SUPERADMIN','ADM','ADMINISTRATION','COM','TEA','STU'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await q.query(`ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT;`);

    // text[] → UPDATE → новый enum (subquery в USING нельзя)
    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" TYPE text[] USING "roles"::text[];
    `);

    await q.query(`
      UPDATE "users"
      SET "roles" = ARRAY(
        SELECT DISTINCT
          CASE r
            WHEN 'ACC' THEN 'ADM'
            WHEN 'INF' THEN 'ADM'
            WHEN 'PHO' THEN 'ADM'
            WHEN 'ANA' THEN 'ADMINISTRATION'
            ELSE r
          END
        FROM unnest("roles") AS r
      );
    `);

    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" TYPE "users_roles_enum_new"[]
      USING "roles"::"users_roles_enum_new"[];
    `);

    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" SET DEFAULT ARRAY['STU']::"users_roles_enum_new"[];
    `);

    await q.query(`DROP TYPE "users_roles_enum";`);
    await q.query(`ALTER TYPE "users_roles_enum_new" RENAME TO "users_roles_enum";`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "users_roles_enum_old" AS ENUM (
          'SUPERADMIN','ADM','ACC','COM','INF','TEA','ANA','PHO','STU'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await q.query(`ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT;`);
    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" TYPE text[] USING "roles"::text[];
    `);
    await q.query(`
      UPDATE "users"
      SET "roles" = ARRAY(
        SELECT CASE r WHEN 'ADMINISTRATION' THEN 'ANA' ELSE r END
        FROM unnest("roles") AS r
      );
    `);
    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" TYPE "users_roles_enum_old"[]
      USING "roles"::"users_roles_enum_old"[];
    `);
    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" SET DEFAULT ARRAY['STU']::"users_roles_enum_old"[];
    `);
    await q.query(`DROP TYPE "users_roles_enum";`);
    await q.query(`ALTER TYPE "users_roles_enum_old" RENAME TO "users_roles_enum";`);
  }
}
