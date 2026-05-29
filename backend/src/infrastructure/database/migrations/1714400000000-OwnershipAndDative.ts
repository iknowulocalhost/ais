import { MigrationInterface, QueryRunner } from 'typeorm';

/** passes/certificate_requests.submitter_user_id + certificate_requests.full_name_dat. */
export class OwnershipAndDative1714400000000 implements MigrationInterface {
  name = 'OwnershipAndDative1714400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "passes"
      ADD COLUMN IF NOT EXISTS "submitter_user_id" uuid
        REFERENCES "users"("id") ON DELETE SET NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "ix_passes_submitter"
      ON "passes" ("submitter_user_id");
    `);

    await q.query(`
      ALTER TABLE "certificate_requests"
      ADD COLUMN IF NOT EXISTS "submitter_user_id" uuid
        REFERENCES "users"("id") ON DELETE SET NULL;
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "ix_cert_submitter"
      ON "certificate_requests" ("submitter_user_id");
    `);

    await q.query(`
      ALTER TABLE "certificate_requests"
      ADD COLUMN IF NOT EXISTS "full_name_dat" varchar(300);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_cert_submitter";`);
    await q.query(`DROP INDEX IF EXISTS "ix_passes_submitter";`);
    await q.query(`ALTER TABLE "certificate_requests" DROP COLUMN IF EXISTS "full_name_dat";`);
    await q.query(`ALTER TABLE "certificate_requests" DROP COLUMN IF EXISTS "submitter_user_id";`);
    await q.query(`ALTER TABLE "passes" DROP COLUMN IF EXISTS "submitter_user_id";`);
  }
}
