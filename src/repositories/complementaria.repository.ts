/**
 * Complementaria Repository
 *
 * Data access for COMPLEMENTARIA_ATTEMPTS table.
 * Tracks student attempts at complementary activities (AI-generated quizzes).
 */

import 'server-only';
import { queryOne, queryMany } from '@/lib/postgres';
import { BaseRepository } from './base.repository';

const JSONB_FIELDS = ['questions', 'answers'];

class ComplementariaRepositoryClass extends BaseRepository {
  constructor() {
    super('COMPLEMENTARIA_ATTEMPTS', JSONB_FIELDS);
  }

  /** Count attempts for a student on a specific step */
  async countAttempts(studentId: string, nivel: string, step: string): Promise<number> {
    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM "COMPLEMENTARIA_ATTEMPTS"
       WHERE "studentId" = $1 AND "nivel" = $2 AND "step" = $3`,
      [studentId, nivel, step]
    );
    return row?.count ?? 0;
  }

  /** Get the latest in-progress attempt (for resuming) */
  async findInProgress(studentId: string, nivel: string, step: string) {
    const row = await queryOne(
      `SELECT * FROM "COMPLEMENTARIA_ATTEMPTS"
       WHERE "studentId" = $1 AND "nivel" = $2 AND "step" = $3
         AND "status" = 'IN_PROGRESS'
       ORDER BY "_createdDate" DESC LIMIT 1`,
      [studentId, nivel, step]
    );
    return row ? this.parse(row) : null;
  }

  /** Check if student already passed this step's activity */
  async hasPassed(studentId: string, nivel: string, step: string): Promise<boolean> {
    const row = await queryOne(
      `SELECT 1 FROM "COMPLEMENTARIA_ATTEMPTS"
       WHERE "studentId" = $1 AND "nivel" = $2 AND "step" = $3
         AND "status" = 'PASSED'
       LIMIT 1`,
      [studentId, nivel, step]
    );
    return !!row;
  }

  /** Get all attempts for a student on a step */
  async findByStudentAndStep(studentId: string, nivel: string, step: string) {
    const rows = await queryMany(
      `SELECT * FROM "COMPLEMENTARIA_ATTEMPTS"
       WHERE "studentId" = $1 AND "nivel" = $2 AND "step" = $3
       ORDER BY "attemptNumber" ASC`,
      [studentId, nivel, step]
    );
    return this.parseMany(rows);
  }

  /** Create a new attempt */
  async createAttempt(data: Record<string, any>) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.map((c) => `"${c}"`).join(', ');

    return queryOne(
      `INSERT INTO "COMPLEMENTARIA_ATTEMPTS" (${columnList}, "_createdDate", "_updatedDate")
       VALUES (${placeholders}, NOW(), NOW())
       RETURNING *`,
      values
    );
  }

  /** Update attempt with answers, score and status */
  async updateAttempt(attemptId: string, data: {
    answers: any;
    score: number;
    passed: boolean;
    status: string;
    bookingId?: string;
  }) {
    return queryOne(
      `UPDATE "COMPLEMENTARIA_ATTEMPTS"
       SET "answers" = $1, "score" = $2, "passed" = $3, "status" = $4,
           "bookingId" = $5, "_updatedDate" = NOW()
       WHERE "_id" = $6
       RETURNING *`,
      [
        JSON.stringify(data.answers),
        data.score,
        data.passed,
        data.status,
        data.bookingId || null,
        attemptId,
      ]
    );
  }
}

export const ComplementariaRepository = new ComplementariaRepositoryClass();
