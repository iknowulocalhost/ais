import { MigrationInterface, QueryRunner } from 'typeorm';

/** users.max_link_prompt_skip_count: сколько раз пользователь закрыл модалку привязки MAX. */
export class MaxLinkPromptSkipCount1715200000000 implements MigrationInterface {
  name = 'MaxLinkPromptSkipCount1715200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "max_link_prompt_skip_count" int NOT NULL DEFAULT 0;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "max_link_prompt_skip_count";`);
  }
}
