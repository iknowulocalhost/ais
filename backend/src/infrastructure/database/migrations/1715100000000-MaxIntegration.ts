import { MigrationInterface, QueryRunner } from 'typeorm';

/** users.max_chat_id + таблица max_link_tokens (one-time, TTL 10 мин). */
export class MaxIntegration1715100000000 implements MigrationInterface {
  name = 'MaxIntegration1715100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "max_chat_id" varchar(64);
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_max_chat_id"
      ON "users" ("max_chat_id")
      WHERE "max_chat_id" IS NOT NULL;
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "max_link_tokens" (
        "token"      varchar(64) PRIMARY KEY,
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "used_at"    timestamptz
      );
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "ix_max_link_tokens_user"
      ON "max_link_tokens" ("user_id");
    `);
    await q.query(`
      CREATE INDEX IF NOT EXISTS "ix_max_link_tokens_expires"
      ON "max_link_tokens" ("expires_at")
      WHERE "used_at" IS NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "max_link_tokens";`);
    await q.query(`DROP INDEX IF EXISTS "ux_users_max_chat_id";`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "max_chat_id";`);
  }
}
