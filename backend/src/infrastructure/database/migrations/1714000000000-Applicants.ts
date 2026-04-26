import { MigrationInterface, QueryRunner } from 'typeorm';

export class Applicants1714000000000 implements MigrationInterface {
  name = 'Applicants1714000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "applicants" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "status"           varchar(16) NOT NULL DEFAULT 'DRAFT',
        "payload_cipher"   bytea NOT NULL,
        "created_by_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "ix_applicants_status" ON "applicants" ("status");`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "ix_applicants_created_by" ON "applicants" ("created_by_id");`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "applicants";`);
  }
}
