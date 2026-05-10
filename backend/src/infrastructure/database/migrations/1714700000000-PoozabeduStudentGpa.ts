import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Денормализуем средний балл студента в зеркало, чтобы /my-group bento и
 * dashboard-аналитика «должников» не били в upstream по 1 запросу на каждого
 * студента. Поле обновляется в ночном sync вместе с прочими полями.
 */
export class PoozabeduStudentGpa1714700000000 implements MigrationInterface {
  name = 'PoozabeduStudentGpa1714700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "poozabedu_student"
      ADD COLUMN IF NOT EXISTS "grade_point_average" numeric(4,2);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "poozabedu_student" DROP COLUMN IF EXISTS "grade_point_average";`);
  }
}
