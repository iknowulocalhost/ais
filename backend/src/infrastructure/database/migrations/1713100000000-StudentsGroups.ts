import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Группы и студенты + retention-политика на audit_logs (3 года).
 */
export class StudentsGroups1713100000000 implements MigrationInterface {
  name = 'StudentsGroups1713100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code"        varchar(32) NOT NULL,
        "name"        varchar(255) NOT NULL,
        "year"        smallint NOT NULL,
        "curator_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_groups_code" ON "groups" ("code");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "students" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"           uuid UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
        "group_id"          uuid REFERENCES "groups"("id") ON DELETE SET NULL,
        "first_name"        varchar(100) NOT NULL,
        "last_name"         varchar(100) NOT NULL,
        "middle_name"       varchar(100),
        "birth_date"        date NOT NULL,
        "status"            varchar(32) NOT NULL DEFAULT 'APPLICANT',
        "avatar_object_key" varchar(512),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_students_status" ON "students" ("status");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_students_group"  ON "students" ("group_id");`);

    // Retention: аудит хранится 3 года. Timescale сам удалит старые чанки.
    await q.query(`
      SELECT add_retention_policy('audit_logs', INTERVAL '3 years', if_not_exists => TRUE);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`SELECT remove_retention_policy('audit_logs', if_exists => TRUE);`);
    await q.query(`DROP TABLE IF EXISTS "students";`);
    await q.query(`DROP TABLE IF EXISTS "groups";`);
  }
}
