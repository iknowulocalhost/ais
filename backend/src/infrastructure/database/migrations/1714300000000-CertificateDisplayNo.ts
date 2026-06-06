import { MigrationInterface, QueryRunner } from 'typeorm';

/** certificate_requests.display_no (sequence) — человекочитаемый номер «С-N». */
export class CertificateDisplayNo1714300000000 implements MigrationInterface {
  name = 'CertificateDisplayNo1714300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SEQUENCE IF NOT EXISTS "certificate_request_no_seq" START 1;`);
    await q.query(`
      ALTER TABLE "certificate_requests"
      ADD COLUMN IF NOT EXISTS "display_no" integer
        NOT NULL DEFAULT nextval('certificate_request_no_seq');
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_cert_display_no"
      ON "certificate_requests" ("display_no");
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ux_cert_display_no";`);
    await q.query(`ALTER TABLE "certificate_requests" DROP COLUMN IF EXISTS "display_no";`);
    await q.query(`DROP SEQUENCE IF EXISTS "certificate_request_no_seq";`);
  }
}
