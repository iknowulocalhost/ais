import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocsPayReports1713200000000 implements MigrationInterface {
  name = 'DocsPayReports1713200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "student_documents" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id"       uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "kind"             varchar(32) NOT NULL,
        "object_key"       varchar(512) NOT NULL,
        "original_name"    varchar(255) NOT NULL,
        "content_type"     varchar(127) NOT NULL,
        "size_bytes"       bigint NOT NULL,
        "status"           varchar(16) NOT NULL DEFAULT 'PENDING',
        "uploaded_by"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "verified_by"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "rejection_reason" text,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_doc_student" ON "student_documents" ("student_id");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id"      uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
        "purpose"         varchar(32) NOT NULL,
        "amount_kopecks"  bigint NOT NULL CHECK ("amount_kopecks" >= 0),
        "currency"        char(3) NOT NULL DEFAULT 'RUB',
        "status"          varchar(16) NOT NULL DEFAULT 'PENDING',
        "due_date"        date NOT NULL,
        "paid_at"         timestamptz,
        "external_ref"    varchar(128),
        "comment"         text,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_payments_student" ON "payments" ("student_id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_payments_status"  ON "payments" ("status");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "report_exports" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "kind"          varchar(32) NOT NULL,
        "requested_by"  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "params"        jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status"        varchar(16) NOT NULL DEFAULT 'QUEUED',
        "object_key"    varchar(512),
        "error_message" text,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_reports_user" ON "report_exports" ("requested_by");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "report_exports";`);
    await q.query(`DROP TABLE IF EXISTS "payments";`);
    await q.query(`DROP TABLE IF EXISTS "student_documents";`);
  }
}
