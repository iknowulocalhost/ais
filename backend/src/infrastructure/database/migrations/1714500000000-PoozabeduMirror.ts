import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Зеркало справочников из Сетевого ПОО (poo.zabedu.ru).
 *
 * Принцип: храним ТОЛЬКО то, что нужно для UX внутри АИС:
 *  - связь по `external_id` (целочисленный id со стороны IRTech);
 *  - ФИО для отображения в дропдаунах и поиске;
 *  - id группы для фильтрации.
 *
 * Паспорт, СНИЛС, адреса, родители — ЗДЕСЬ НЕ ХРАНЯТСЯ. Их можно получить
 * только on-demand через прокси к Сетевому ПОО для авторизованного оператора.
 *
 * `is_active=false` означает, что запись исчезла из upstream
 * (отчисление, удаление подразделения и т.п.). Жёстко не удаляем — на запись
 * могут ссылаться заявки на справки/пропуска.
 */
export class PoozabeduMirror1714500000000 implements MigrationInterface {
  name = 'PoozabeduMirror1714500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "poozabedu_department" (
        "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_id"          integer NOT NULL,
        "name"                 varchar(200) NOT NULL,
        "manager_external_id"  integer,
        "is_active"            boolean NOT NULL DEFAULT true,
        "synced_at"            timestamptz NOT NULL,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_pza_dept_external_id"
                   ON "poozabedu_department" ("external_id");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "poozabedu_student_group" (
        "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_id"              integer NOT NULL,
        "name"                     varchar(100) NOT NULL,
        "code"                     varchar(100),
        "year_number"              integer,
        "education_form"           varchar(32),
        "department_external_id"   integer,
        "curator_external_id"      integer,
        "is_active"                boolean NOT NULL DEFAULT true,
        "synced_at"                timestamptz NOT NULL,
        "created_at"               timestamptz NOT NULL DEFAULT now(),
        "updated_at"               timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_pza_group_external_id"
                   ON "poozabedu_student_group" ("external_id");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "poozabedu_student" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_id"         integer NOT NULL,
        "last_name"           varchar(120) NOT NULL,
        "first_name"          varchar(120) NOT NULL,
        "middle_name"         varchar(120),
        "birth_date"          date,
        "gender"              varchar(16),
        "group_external_id"   integer,
        "group_name"          varchar(100),
        "education_basis"     varchar(32),
        "is_active"           boolean NOT NULL DEFAULT true,
        "synced_at"           timestamptz NOT NULL,
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_pza_student_external_id"
                   ON "poozabedu_student" ("external_id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_pza_student_group"
                   ON "poozabedu_student" ("group_external_id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_pza_student_active"
                   ON "poozabedu_student" ("is_active");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "poozabedu_student";`);
    await q.query(`DROP TABLE IF EXISTS "poozabedu_student_group";`);
    await q.query(`DROP TABLE IF EXISTS "poozabedu_department";`);
  }
}
