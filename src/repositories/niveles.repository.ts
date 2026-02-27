/**
 * Niveles Repository
 *
 * All SQL for NIVELES and STEP_OVERRIDES tables.
 */

import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { BaseRepository } from './base.repository';

const NIVELES_JSONB = ['material', 'clubs', 'steps', 'materiales'];

// ── NIVELES ──

class NivelesRepositoryClass extends BaseRepository {
  constructor() {
    super('NIVELES', NIVELES_JSONB);
  }

  /**
   * Get all levels ordered
   */
  async findAll() {
    const rows = await queryMany(
      `SELECT "_id", "code", "step", "description", "esParalelo", "material",
              "clubs", "steps", "materiales", "orden", "videoUrl", "_createdDate", "_updatedDate"
       FROM "NIVELES"
       ORDER BY "orden" ASC NULLS LAST, "code" ASC`
    );
    return this.parseMany(rows);
  }

  /**
   * Get all steps for a specific nivel
   */
  async findByCode(code: string) {
    const rows = await queryMany(
      `SELECT "_id", "code", "step", "description", "esParalelo", "material",
              "clubs", "steps", "materiales", "orden", "videoUrl", "_createdDate", "_updatedDate"
       FROM "NIVELES"
       WHERE "code" = $1
       ORDER BY "orden" ASC NULLS LAST, "step" ASC`,
      [code]
    );
    return this.parseMany(rows);
  }

  /**
   * Get videoUrl for a specific nivel + step combination
   */
  async findVideoByNivelAndStep(nivel: string, step: string) {
    return queryOne<{ videoUrl: string | null }>(
      `SELECT "videoUrl" FROM "NIVELES"
       WHERE "code" = $1 AND "step" = $2
       LIMIT 1`,
      [nivel, step]
    );
  }

  /**
   * Lookup nivel/step by step name (for student step changes)
   */
  async findByStepName(stepName: string) {
    return queryOne<{ code: string; step: string; esParalelo: boolean }>(
      `SELECT "code", "step", "esParalelo"
       FROM "NIVELES"
       WHERE "step" = $1
       LIMIT 1`,
      [stepName]
    );
  }

  /**
   * Get nivel info with steps list
   */
  async getStepsForNivel(code: string) {
    return queryMany(
      `SELECT "code", "step", "steps", "esParalelo", "clubs", "description"
       FROM "NIVELES"
       WHERE "code" = $1
       ORDER BY "step"`,
      [code]
    );
  }
}

// ── STEP_OVERRIDES ──

class StepOverridesRepositoryClass extends BaseRepository {
  constructor() {
    super('STEP_OVERRIDES');
  }

  /**
   * Get all overrides for a student
   */
  async findByStudentId(studentId: string) {
    return queryMany(
      `SELECT * FROM "STEP_OVERRIDES"
       WHERE "studentId" = $1
       ORDER BY "step", "_createdDate" DESC`,
      [studentId]
    );
  }

  /**
   * Get overrides for a specific nivel
   */
  async findByStudentAndNivel(studentId: string, nivel: string) {
    return queryMany<{ step: string; isCompleted: boolean }>(
      `SELECT "step", "isCompleted"
       FROM "STEP_OVERRIDES"
       WHERE "studentId" = $1 AND "nivel" = $2`,
      [studentId, nivel]
    );
  }

  /**
   * Find a specific override
   */
  async findByStudentAndStep(studentId: string, step: string) {
    return queryOne<{ _id: string; isCompleted: boolean }>(
      `SELECT "_id", "isCompleted" FROM "STEP_OVERRIDES"
       WHERE "studentId" = $1 AND "step" = $2`,
      [studentId, step]
    );
  }

  /**
   * Create a step override
   */
  async create(data: {
    _id: string;
    studentId: string;
    nivel: string;
    step: string;
    isCompleted: boolean;
  }) {
    return queryOne(
      `INSERT INTO "STEP_OVERRIDES" (
        "_id", "studentId", "nivel", "step", "isCompleted",
        "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      )
      RETURNING *`,
      [data._id, data.studentId, data.nivel, data.step, data.isCompleted]
    );
  }

  /**
   * Update an existing override
   */
  async update(id: string, isCompleted: boolean) {
    return queryOne(
      `UPDATE "STEP_OVERRIDES"
       SET "isCompleted" = $1,
           "_updatedDate" = NOW()
       WHERE "_id" = $2
       RETURNING *`,
      [isCompleted, id]
    );
  }

  /**
   * Delete a step override
   */
  async deleteByStudentAndStep(studentId: string, step: string) {
    const result = await query(
      `DELETE FROM "STEP_OVERRIDES"
       WHERE "studentId" = $1 AND "step" = $2
       RETURNING "_id"`,
      [studentId, step]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const NivelesRepository = new NivelesRepositoryClass();
export const StepOverridesRepository = new StepOverridesRepositoryClass();
