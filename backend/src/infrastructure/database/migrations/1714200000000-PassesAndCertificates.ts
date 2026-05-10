import { MigrationInterface, QueryRunner } from 'typeorm';

export class PassesAndCertificates1714200000000 implements MigrationInterface {
  name = 'PassesAndCertificates1714200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "passes" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "full_name"          varchar(255) NOT NULL,
        "group_or_position"  varchar(100) NOT NULL,
        "hostel"             varchar(8)   NOT NULL DEFAULT 'NONE',
        "ticket_key"         varchar(512),
        "max_user_id"        varchar(64),
        "status"             varchar(16)  NOT NULL DEFAULT 'PENDING',
        "status_comment"     varchar(500),
        "reviewer_id"        uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"         timestamptz  NOT NULL DEFAULT now(),
        "updated_at"         timestamptz  NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_passes_status" ON "passes" ("status");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "certificate_requests" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cert_type"      varchar(16)  NOT NULL,
        "full_name"      varchar(255) NOT NULL,
        "birth_date"     date         NOT NULL,
        "group_name"     varchar(50)  NOT NULL,
        "target_org"     varchar(255) NOT NULL,
        "phone"          varchar(32)  NOT NULL,
        "email"          varchar(320) NOT NULL,
        "comment"        text,
        "period_from"    date,
        "period_to"      date,
        "status"         varchar(16)  NOT NULL DEFAULT 'PENDING',
        "status_comment" varchar(500),
        "reviewer_id"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "max_user_id"    varchar(64),
        "created_at"     timestamptz  NOT NULL DEFAULT now(),
        "updated_at"     timestamptz  NOT NULL DEFAULT now()
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_cert_status" ON "certificate_requests" ("status");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_cert_type"   ON "certificate_requests" ("cert_type");`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "comment_options" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"      varchar(100) NOT NULL,
        "text"       varchar(255) NOT NULL,
        "is_default" boolean      NOT NULL DEFAULT false,
        "created_at" timestamptz  NOT NULL DEFAULT now()
      );
    `);

    // Сид: типичные комментарии для отказа/выдачи. Идемпотентно по title.
    await q.query(`
      INSERT INTO "comment_options" ("title", "text", "is_default") VALUES
        ('Готово', 'Заявка обработана. Документ можно забрать в учебной части.', true),
        ('Нет квитанции', 'Не приложена квитанция об оплате — приложите файл и подайте заявку повторно.', false),
        ('Неверная группа', 'Указана несуществующая группа. Уточните номер группы и подайте заявку повторно.', false),
        ('Дубликат', 'Аналогичная заявка уже зарегистрирована.', false)
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "comment_options";`);
    await q.query(`DROP TABLE IF EXISTS "certificate_requests";`);
    await q.query(`DROP TABLE IF EXISTS "passes";`);
  }
}
