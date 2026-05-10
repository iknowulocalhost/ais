import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Рефакторинг ролевой модели: оставляем 6 рабочих ролей —
 * SUPERADMIN, ADM, ADMINISTRATION, COM, TEA, STU.
 *
 *  - ACC, INF, ANA, PHO больше не используются: ACC/INF/PHO мигрируем в ADM,
 *    ANA — в новую ADMINISTRATION (роль администрации колледжа: директор,
 *    заместители, кадровая служба).
 *  - Перевод массивов `users.roles[]` делаем in-place до удаления значений из enum.
 *
 * Postgres до v17 не умеет удалять значения enum, поэтому пересоздаём тип:
 * создаём новый enum, перевешиваем колонку, дропаем старый.
 */
export class RolesRefactor1714800000000 implements MigrationInterface {
  name = 'RolesRefactor1714800000000';

  public async up(q: QueryRunner): Promise<void> {
    // 1. Создаём новый enum.
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "users_roles_enum_new" AS ENUM (
          'SUPERADMIN','ADM','ADMINISTRATION','COM','TEA','STU'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 2. Снимаем дефолт со старой колонки (иначе ALTER TYPE ругнётся).
    await q.query(`ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT;`);

    // 3. Postgres не пускает subquery в USING-клаузе ALTER COLUMN TYPE.
    //    Поэтому переводим колонку через text[]: сначала кастим, потом
    //    делаем UPDATE с заменой значений, и только затем кастим в новый enum.
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

    // 4. Возвращаем дефолт.
    await q.query(`
      ALTER TABLE "users"
      ALTER COLUMN "roles" SET DEFAULT ARRAY['STU']::"users_roles_enum_new"[];
    `);

    // 5. Дропаем старый enum, переименовываем новый под старое имя.
    await q.query(`DROP TYPE "users_roles_enum";`);
    await q.query(`ALTER TYPE "users_roles_enum_new" RENAME TO "users_roles_enum";`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Возврат: добавляем старые значения обратно в enum. Ранее снесённые
    // массивы ролей восстановить нельзя — оставляем как есть.
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
