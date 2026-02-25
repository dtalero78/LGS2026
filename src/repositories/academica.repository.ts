/**
 * Academica Repository
 *
 * All SQL for the ACADEMICA table (~4 route handlers).
 */

import 'server-only';
import { queryOne, queryMany, parseJsonbFields } from '@/lib/postgres';
import { BaseRepository } from './base.repository';
import { NotFoundError } from '@/lib/errors';

const JSONB_FIELDS = ['extensionHistory'];

class AcademicaRepositoryClass extends BaseRepository {
  constructor() {
    super('ACADEMICA', JSONB_FIELDS);
  }

  /**
   * Flexible lookup: match by _id, studentId, peopleId, or numeroId
   */
  async findByAnyId(id: string) {
    const row = await queryOne(
      `SELECT "_id", "studentId", "numeroId", "nivel", "step", "nivelParalelo", "stepParalelo",
              "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
              "asesor", "fechaNacimiento", "celular", "telefono", "email", "contrato",
              "fechaCreacion", "tipoUsuario", "plataforma", "usuarioId", "peopleId",
              "estadoInactivo", "fechaContrato", "finalContrato", "vigencia",
              "extensionCount", "extensionHistory", "onHoldCount"
       FROM "ACADEMICA"
       WHERE "_id" = $1 OR "studentId" = $1 OR "peopleId" = $1 OR "numeroId" = $1`,
      [id]
    );
    return this.parse(row);
  }

  async findByAnyIdOrThrow(id: string) {
    const row = await this.findByAnyId(id);
    if (!row) throw new NotFoundError('Academic record', id);
    return row;
  }

  /**
   * Find by numeroId
   */
  async findByNumeroId(numeroId: string) {
    const row = await queryOne(
      `SELECT * FROM "ACADEMICA" WHERE "numeroId" = $1`,
      [numeroId]
    );
    return this.parse(row);
  }

  /**
   * Check if a student has an academic record
   */
  async existsByNumeroId(numeroId: string): Promise<boolean> {
    const row = await queryOne(
      `SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`,
      [numeroId]
    );
    return row !== null;
  }

  /**
   * Student profile: ACADEMICA joined with PEOPLE
   */
  async findProfileById(id: string) {
    const row = await queryOne(
      `SELECT a."_id", a."numeroId", a."primerNombre", a."segundoNombre", a."primerApellido", a."segundoApellido",
              p."celular", p."telefono", p."email", p."domicilio", p."ciudad", p."fechaNacimiento",
              p."contrato", a."fechaCreacion", p."tipoUsuario", a."plataforma",
              a."nivel", a."step", a."nivelParalelo", a."stepParalelo", p."aprobacion",
              COALESCE(p."estadoInactivo", a."estadoInactivo"::boolean) AS "estadoInactivo", p."estado", p."fechaOnHold", p."fechaFinOnHold",
              p."vigenciaOriginalPreOnHold", p."onHoldCount", p."onHoldHistory",
              p."extensionCount", p."extensionHistory", p."fechaContrato", p."finalContrato",
              COALESCE(p."vigencia"::text, a."vigencia"::text) AS "vigencia",
              p."titularId", a."asesor", a."usuarioId", p."_id" AS "peopleId", p."ingresos", p."genero",
              COALESCE(a."clave", p."clave") AS "clave",
              p."empresa", p."cargo", p."referenciaUno", p."parentezcoRefUno", p."telefonoRefUno",
              p."referenciaDos", p."parentezcoRefDos", p."telefonoRefDos",
              a."_createdDate", a."_updatedDate", p."documentacion"
       FROM "ACADEMICA" a
       LEFT JOIN "PEOPLE" p ON a."numeroId" = p."numeroId"
       WHERE a."_id" = $1`,
      [id]
    );
    if (!row) return null;
    return parseJsonbFields(row, ['onHoldHistory', 'extensionHistory']);
  }

  /**
   * Search in ACADEMICA with PEOPLE join
   */
  async searchWithPeople(term: string, limit: number = 100) {
    const pattern = `%${term}%`;
    return queryMany(
      `SELECT a."_id", a."numeroId", a."nivel", a."step", a."nivelParalelo", a."stepParalelo",
              p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido",
              p."tipoUsuario", p."email", p."contrato"
       FROM "ACADEMICA" a
       INNER JOIN "PEOPLE" p ON a."numeroId" = p."numeroId"
       WHERE (LOWER(p."primerNombre") LIKE LOWER($1)
           OR LOWER(p."primerApellido") LIKE LOWER($1)
           OR a."numeroId" LIKE $1
           OR p."contrato" LIKE $1)
       ORDER BY p."primerNombre", p."primerApellido"
       LIMIT $2`,
      [pattern, limit]
    );
  }

  /**
   * Create academic record
   */
  async create(data: Record<string, any>) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.map((c) => `"${c}"`).join(', ');

    return queryOne(
      `INSERT INTO "ACADEMICA" (${columnList}, "_createdDate", "_updatedDate")
       VALUES (${placeholders}, NOW(), NOW())
       RETURNING *`,
      values
    );
  }

  /**
   * Update nivel/step (regular or parallel)
   */
  async updateStep(numeroId: string, nivel: string, step: string, isParallel: boolean) {
    const [col1, col2] = isParallel
      ? ['"nivelParalelo"', '"stepParalelo"']
      : ['"nivel"', '"step"'];

    return queryOne(
      `UPDATE "ACADEMICA"
       SET ${col1} = $1, ${col2} = $2, "_updatedDate" = NOW()
       WHERE "numeroId" = $3
       RETURNING *`,
      [nivel, step, numeroId]
    );
  }

  // ── Dashboard helpers ──

  async countTotal(): Promise<number> {
    return this.count();
  }
}

export const AcademicaRepository = new AcademicaRepositoryClass();
