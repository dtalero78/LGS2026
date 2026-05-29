/**
 * Jump Evaluation Repository
 *
 * All SQL for the JUMP_EVALUATIONS table — the report produced by the Realtime
 * voice tutor when a student takes the oral Jump exam for a whole level.
 *
 * The bot does NOT approve the Jump. It saves a report (score + criteria +
 * strengths/weaknesses + recommendation) with `reviewStatus = 'PENDIENTE'`.
 * A human advisor/admin reviews it and, on approval, the actual Jump booking
 * is created + autoAdvanceStep is triggered elsewhere.
 *
 * Table is auto-created on first use (CREATE TABLE IF NOT EXISTS), following the
 * same idempotent pattern as `auditautoaprov` / `MATERIAL_AUDIT`.
 */

import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';

const JSONB_FIELDS = ['criterios', 'fortalezas', 'debilidades', 'transcript'];

export interface JumpEvaluation {
  _id: string;
  studentId: string;        // ACADEMICA._id
  numeroId: string | null;
  nivel: string;
  jumpStep: string;         // e.g. "Step 5"
  plataforma: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  score: number | null;     // 0-100
  recomendacion: 'APROBAR' | 'REPROBAR' | 'REVISAR' | null;
  criterios: Record<string, number> | null; // {pronunciacion, fluidez, gramatica, vocabulario, comprension}
  fortalezas: string[] | null;
  debilidades: string[] | null;
  resumen: string | null;
  transcript: any[] | null;
  durationSec: number | null;
  reviewStatus: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNota: string | null;
  _createdDate: string;
  _updatedDate: string;
}

let ensured = false;

/** Idempotent table creation. Runs once per server boot. */
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS "JUMP_EVALUATIONS" (
      "_id" VARCHAR(64) PRIMARY KEY,
      "studentId" VARCHAR(64) NOT NULL,
      "numeroId" VARCHAR(64),
      "nivel" VARCHAR(20) NOT NULL,
      "jumpStep" VARCHAR(40) NOT NULL,
      "plataforma" VARCHAR(50),
      "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
      "score" INTEGER,
      "recomendacion" VARCHAR(20),
      "criterios" JSONB,
      "fortalezas" JSONB,
      "debilidades" JSONB,
      "resumen" TEXT,
      "transcript" JSONB,
      "durationSec" INTEGER,
      "reviewStatus" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
      "reviewedBy" VARCHAR(255),
      "reviewedAt" TIMESTAMPTZ,
      "reviewNota" TEXT,
      "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "_updatedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS "idx_jumpeval_student" ON "JUMP_EVALUATIONS" ("studentId", "_createdDate" DESC)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS "idx_jumpeval_review" ON "JUMP_EVALUATIONS" ("reviewStatus", "_createdDate" DESC)`
  );
  ensured = true;
}

function parse(row: any): JumpEvaluation | null {
  if (!row) return null;
  for (const f of JSONB_FIELDS) {
    if (typeof row[f] === 'string') {
      try { row[f] = JSON.parse(row[f]); } catch { /* leave as-is */ }
    }
  }
  return row as JumpEvaluation;
}

class JumpEvaluationRepositoryClass {
  /** Create an IN_PROGRESS evaluation row when the session starts. */
  async createInProgress(data: {
    _id: string;
    studentId: string;
    numeroId?: string | null;
    nivel: string;
    jumpStep: string;
    plataforma?: string | null;
  }): Promise<JumpEvaluation | null> {
    await ensureTable();
    const row = await queryOne(
      `INSERT INTO "JUMP_EVALUATIONS"
        ("_id", "studentId", "numeroId", "nivel", "jumpStep", "plataforma", "status")
       VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS')
       RETURNING *`,
      [data._id, data.studentId, data.numeroId ?? null, data.nivel, data.jumpStep, data.plataforma ?? null]
    );
    return parse(row);
  }

  async findById(id: string): Promise<JumpEvaluation | null> {
    await ensureTable();
    return parse(await queryOne(`SELECT * FROM "JUMP_EVALUATIONS" WHERE "_id" = $1`, [id]));
  }

  /** How many evaluations the student already has for this nivel's jump. */
  async countByStudentAndNivel(studentId: string, nivel: string): Promise<number> {
    await ensureTable();
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "JUMP_EVALUATIONS"
       WHERE "studentId" = $1 AND "nivel" = $2 AND "status" = 'COMPLETED'`,
      [studentId, nivel]
    );
    return parseInt(row?.count ?? '0', 10);
  }

  /** Persist the bot's report. Marks the evaluation COMPLETED + PENDIENTE review. */
  async saveReport(
    id: string,
    report: {
      score: number;
      recomendacion: 'APROBAR' | 'REPROBAR' | 'REVISAR';
      criterios?: Record<string, number> | null;
      fortalezas?: string[] | null;
      debilidades?: string[] | null;
      resumen?: string | null;
      transcript?: any[] | null;
      durationSec?: number | null;
    }
  ): Promise<JumpEvaluation | null> {
    await ensureTable();
    const row = await queryOne(
      `UPDATE "JUMP_EVALUATIONS"
       SET "status" = 'COMPLETED',
           "score" = $2,
           "recomendacion" = $3,
           "criterios" = $4::jsonb,
           "fortalezas" = $5::jsonb,
           "debilidades" = $6::jsonb,
           "resumen" = $7,
           "transcript" = $8::jsonb,
           "durationSec" = $9,
           "reviewStatus" = 'PENDIENTE',
           "_updatedDate" = NOW()
       WHERE "_id" = $1
       RETURNING *`,
      [
        id,
        Math.round(report.score),
        report.recomendacion,
        report.criterios ? JSON.stringify(report.criterios) : null,
        report.fortalezas ? JSON.stringify(report.fortalezas) : null,
        report.debilidades ? JSON.stringify(report.debilidades) : null,
        report.resumen ?? null,
        report.transcript ? JSON.stringify(report.transcript) : null,
        report.durationSec ?? null,
      ]
    );
    return parse(row);
  }

  /** Admin: list evaluations, optionally filtered by review status / nivel. */
  async findForReview(opts: {
    reviewStatus?: string;
    nivel?: string;
    limit?: number;
  } = {}): Promise<JumpEvaluation[]> {
    await ensureTable();
    const where: string[] = [`"status" = 'COMPLETED'`];
    const params: any[] = [];
    if (opts.reviewStatus) { params.push(opts.reviewStatus); where.push(`"reviewStatus" = $${params.length}`); }
    if (opts.nivel) { params.push(opts.nivel); where.push(`"nivel" = $${params.length}`); }
    params.push(opts.limit ?? 200);
    const rows = await queryMany(
      `SELECT * FROM "JUMP_EVALUATIONS"
       WHERE ${where.join(' AND ')}
       ORDER BY "_createdDate" DESC
       LIMIT $${params.length}`,
      params
    );
    return rows.map(parse).filter(Boolean) as JumpEvaluation[];
  }

  /** Admin: record the review decision. */
  async setReview(
    id: string,
    reviewStatus: 'APROBADO' | 'RECHAZADO',
    reviewedBy: string,
    nota?: string | null
  ): Promise<JumpEvaluation | null> {
    await ensureTable();
    const row = await queryOne(
      `UPDATE "JUMP_EVALUATIONS"
       SET "reviewStatus" = $2,
           "reviewedBy" = $3,
           "reviewNota" = $4,
           "reviewedAt" = NOW(),
           "_updatedDate" = NOW()
       WHERE "_id" = $1
       RETURNING *`,
      [id, reviewStatus, reviewedBy, nota ?? null]
    );
    return parse(row);
  }
}

export const JumpEvaluationRepository = new JumpEvaluationRepositoryClass();
