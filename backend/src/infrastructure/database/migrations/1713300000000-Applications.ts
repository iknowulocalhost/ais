import { MigrationInterface, QueryRunner } from 'typeorm';

export class Applications1713300000000 implements MigrationInterface {
  name = 'Applications1713300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "applications" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "first_name"       varchar(100) NOT NULL,
        "last_name"        varchar(100) NOT NULL,
        "middle_name"      varchar(100),
        "birth_date"       date NOT NULL,
        "email"            varchar(320) NOT NULL,
        "phone"            varchar(32),
        "program_code"     varchar(32) NOT NULL,
        "status"           varchar(16) NOT NULL DEFAULT 'SUBMITTED',
        "rejection_reason" text,
        "reviewer_id"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "student_id"       uuid REFERENCES "students"("id") ON DELETE SET NULL,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_applications_status"  ON "applications" ("status");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_applications_program" ON "applications" ("program_code");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_applications_email"   ON "applications" ("email");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "applications";`);
  }
}
