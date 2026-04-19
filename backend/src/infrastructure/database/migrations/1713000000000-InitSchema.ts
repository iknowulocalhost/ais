import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Начальная схема: роли, users, audit_logs (+ hypertable TimescaleDB).
 */
export class InitSchema1713000000000 implements MigrationInterface {
  name = 'InitSchema1713000000000';

  public async up(q: QueryRunner): Promise<void> {
    // Расширения (страховка — init-скрипт Postgres их уже создаёт).
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS timescaledb;`);

    // Enum ролей.
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "users_roles_enum" AS ENUM (
          'SUPERADMIN','ADM','ACC','COM','INF','TEA','ANA','PHO','STU'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Таблица пользователей.
    await q.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"         varchar(320) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "first_name"    varchar(100) NOT NULL,
        "last_name"     varchar(100) NOT NULL,
        "middle_name"   varchar(100),
        "roles"         "users_roles_enum"[] NOT NULL DEFAULT ARRAY['STU']::"users_roles_enum"[],
        "is_active"     boolean NOT NULL DEFAULT true,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "last_login_at" timestamptz
      );
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_email" ON "users" (lower("email"));`);

    // Журнал аудита: составной PK (ts, id) — требование Timescale для hypertable.
    await q.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "ts"         timestamptz NOT NULL DEFAULT now(),
        "id"         uuid         NOT NULL DEFAULT gen_random_uuid(),
        "actor_id"   uuid,
        "action"     varchar(64)  NOT NULL,
        "entity"     varchar(64)  NOT NULL,
        "entity_id"  varchar(64),
        "ip_address" inet,
        "user_agent" text,
        "old_state"  jsonb,
        "new_state"  jsonb,
        "meta"       jsonb,
        PRIMARY KEY ("ts","id")
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_audit_entity" ON "audit_logs" ("entity","entity_id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_audit_actor"  ON "audit_logs" ("actor_id");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_audit_action" ON "audit_logs" ("action");`);

    // Превращаем таблицу в hypertable (чанки по 7 дней).
    await q.query(`
      SELECT create_hypertable('audit_logs', 'ts',
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists => TRUE);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await q.query(`DROP TABLE IF EXISTS "users";`);
    await q.query(`DROP TYPE IF EXISTS "users_roles_enum";`);
  }
}
