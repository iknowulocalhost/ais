import { MigrationInterface, QueryRunner } from 'typeorm';

/** Очередь исходящих MAX-уведомлений. Бот опрашивает через /outbox + /ack. */
export class MaxOutbox1715300000000 implements MigrationInterface {
  name = 'MaxOutbox1715300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "max_outbox" (
        "id"           bigserial PRIMARY KEY,
        "user_id"      uuid,
        "max_chat_id"  varchar(64) NOT NULL,
        "text"         text        NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "delivered_at" timestamptz
      );
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "ix_max_outbox_pending"
      ON "max_outbox" ("id") WHERE "delivered_at" IS NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "max_outbox";`);
  }
}
