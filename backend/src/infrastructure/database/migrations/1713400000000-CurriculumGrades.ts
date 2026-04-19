import { MigrationInterface, QueryRunner } from 'typeorm';

export class CurriculumGrades1713400000000 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    // 1. Дисциплины
    await qr.query(`
      CREATE TABLE disciplines (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code        VARCHAR(32)  NOT NULL UNIQUE,
        name        VARCHAR(255) NOT NULL,
        total_hours INT          NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      );
    `);

    // 2. Учебные планы
    await qr.query(`
      CREATE TABLE curriculum_plans (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_code   VARCHAR(32)  NOT NULL,
        admission_year INT          NOT NULL,
        name           VARCHAR(255) NOT NULL,
        status         VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_curriculum_plans_program_year ON curriculum_plans (program_code, admission_year);
      CREATE INDEX ix_curriculum_plans_status       ON curriculum_plans (status);
    `);

    // 3. Записи учебного плана (дисциплина + семестр)
    await qr.query(`
      CREATE TABLE curriculum_entries (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id       UUID        NOT NULL REFERENCES curriculum_plans(id) ON DELETE CASCADE,
        discipline_id UUID        NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
        semester      INT         NOT NULL,
        control_form  VARCHAR(16) NOT NULL,
        hours         INT         NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (plan_id, discipline_id, semester)
      );
      CREATE INDEX ix_curriculum_entries_plan ON curriculum_entries (plan_id);
    `);

    // 4. Ведомости
    await qr.query(`
      CREATE TABLE grade_sheets (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id            UUID        NOT NULL REFERENCES groups(id)             ON DELETE RESTRICT,
        curriculum_entry_id UUID        NOT NULL REFERENCES curriculum_entries(id)  ON DELETE RESTRICT,
        teacher_id          UUID        NOT NULL REFERENCES users(id)              ON DELETE RESTRICT,
        date                DATE        NOT NULL,
        status              VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_grade_sheets_group   ON grade_sheets (group_id);
      CREATE INDEX ix_grade_sheets_teacher ON grade_sheets (teacher_id);
      CREATE INDEX ix_grade_sheets_entry   ON grade_sheets (curriculum_entry_id);
    `);

    // 5. Оценки
    await qr.query(`
      CREATE TABLE grades (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sheet_id   UUID        NOT NULL REFERENCES grade_sheets(id) ON DELETE CASCADE,
        student_id UUID        NOT NULL REFERENCES students(id)     ON DELETE RESTRICT,
        value      INT,
        comment    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (sheet_id, student_id)
      );
      CREATE INDEX ix_grades_sheet   ON grades (sheet_id);
      CREATE INDEX ix_grades_student ON grades (student_id);
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query('DROP TABLE IF EXISTS grades CASCADE');
    await qr.query('DROP TABLE IF EXISTS grade_sheets CASCADE');
    await qr.query('DROP TABLE IF EXISTS curriculum_entries CASCADE');
    await qr.query('DROP TABLE IF EXISTS curriculum_plans CASCADE');
    await qr.query('DROP TABLE IF EXISTS disciplines CASCADE');
  }
}
