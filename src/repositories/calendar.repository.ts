/**
 * Calendar Repository
 *
 * All SQL for the CALENDARIO table (~6 route handlers).
 */

import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { BaseRepository } from './base.repository';
import { buildDynamicWhere, WhereFilter } from '@/lib/query-builder';

export interface EventFilters {
  startDate?: string;
  endDate?: string;
  tipo?: string;
  advisor?: string;
  nivel?: string;
  step?: string;
  limit?: number;
  includeBookingCounts?: boolean;
}

class CalendarioRepositoryClass extends BaseRepository {
  constructor() {
    super('CALENDARIO');
  }

  /**
   * Get event by ID with advisor details
   */
  async findByIdWithAdvisor(id: string) {
    return queryOne(
      `SELECT c.*, a."primerNombre" as "advisorPrimerNombre",
              a."primerApellido" as "advisorPrimerApellido",
              a."nombreCompleto" as "advisorNombreCompleto",
              a."email" as "advisorEmail"
       FROM "CALENDARIO" c
       LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
       WHERE c."_id" = $1`,
      [id]
    );
  }

  /**
   * Get events with dynamic filters and advisor details
   */
  async findEvents(filters: EventFilters) {
    const whereFilters: WhereFilter[] = [
      { field: 'c."dia"', value: filters.startDate, operator: '>=', cast: '::timestamp' },
      { field: 'c."dia"', value: filters.endDate, operator: '<=', cast: '::timestamp' },
      { field: 'c."tipo"', value: filters.tipo },
      { field: 'c."nivel"', value: filters.nivel },
      { field: 'c."step"', value: filters.step },
    ];

    // Advisor filter uses case-insensitive match
    if (filters.advisor) {
      whereFilters.push({ field: 'c."advisor"', value: filters.advisor.toLowerCase(), operator: 'ILIKE' });
    }

    // Build WHERE clause manually since columns have table alias
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const f of whereFilters) {
      if (f.value === undefined || f.value === null) continue;
      const cast = f.cast || '';
      if (f.operator === 'ILIKE') {
        conditions.push(`LOWER(${f.field}) = LOWER($${idx}${cast})`);
      } else {
        conditions.push(`${f.field} ${f.operator || '='} $${idx}${cast}`);
      }
      params.push(f.value);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT $${idx}` : '';
    if (filters.limit) params.push(filters.limit);

    return queryMany(
      `SELECT c."_id", c."tipo", c."fecha", c."hora", c."advisor", c."nivel", c."step",
              c."club", c."titulo", c."observaciones", c."linkZoom", c."limiteUsuarios",
              c."inscritos", c."origen", c."dia", c."evento", c."nombreEvento", c."tituloONivel",
              c."_createdDate", c."_updatedDate",
              a."primerNombre" as "advisorPrimerNombre",
              a."primerApellido" as "advisorPrimerApellido",
              a."nombreCompleto" as "advisorNombreCompleto",
              a."email" as "advisorEmail"
       FROM "CALENDARIO" c
       LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
       ${whereClause}
       ORDER BY c."dia" DESC
       ${limitClause}`,
      params
    );
  }

  /**
   * Get advisor's events with booking counts
   */
  async findAdvisorEvents(
    advisorId: string,
    opts?: { startDate?: string; endDate?: string; tipo?: string }
  ) {
    const conditions = [`c."advisor" = $1`];
    const params: any[] = [advisorId];
    let idx = 2;

    if (opts?.startDate) {
      conditions.push(`c."dia" >= $${idx++}::timestamp with time zone`);
      params.push(opts.startDate);
    }
    if (opts?.endDate) {
      conditions.push(`c."dia" <= $${idx++}::timestamp with time zone`);
      params.push(opts.endDate);
    }
    if (opts?.tipo) {
      conditions.push(`c."tipo" = $${idx++}`);
      params.push(opts.tipo);
    }

    return queryMany(
      `SELECT c.*,
              COUNT(DISTINCT b."_id") as "bookingCount",
              COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "asistenciasCount",
              COUNT(DISTINCT CASE WHEN b."asistio" = false THEN b."_id" END) as "ausenciasCount"
       FROM "CALENDARIO" c
       LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
       WHERE ${conditions.join(' AND ')}
       GROUP BY c."_id"
       ORDER BY c."dia" DESC, c."hora" DESC`,
      params
    );
  }

  /**
   * Get events with booking counts (GROUP BY query)
   */
  async findEventsWithBookingCounts(filters: EventFilters) {
    const whereFilters: WhereFilter[] = [
      { field: 'c."dia"', value: filters.startDate, operator: '>=', cast: '::timestamp with time zone' },
      { field: 'c."dia"', value: filters.endDate, operator: '<=', cast: '::timestamp with time zone' },
      { field: 'c."tipo"', value: filters.tipo },
      { field: 'c."nivel"', value: filters.nivel },
      { field: 'c."step"', value: filters.step },
    ];

    if (filters.advisor) {
      whereFilters.push({ field: 'c."advisor"', value: filters.advisor });
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const f of whereFilters) {
      if (f.value === undefined || f.value === null) continue;
      const cast = f.cast || '';
      conditions.push(`${f.field} ${f.operator || '='} $${idx}${cast}`);
      params.push(f.value);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return queryMany(
      `SELECT c.*,
              a."primerNombre" as "advisorPrimerNombre",
              a."primerApellido" as "advisorPrimerApellido",
              a."nombreCompleto" as "advisorNombreCompleto",
              COUNT(DISTINCT b."_id") as "bookingCount",
              COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "asistenciasCount",
              COUNT(DISTINCT CASE WHEN b."asistio" = false THEN b."_id" END) as "ausenciasCount"
       FROM "CALENDARIO" c
       LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
       LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
       ${whereClause}
       GROUP BY c."_id", a."primerNombre", a."primerApellido", a."nombreCompleto"
       ORDER BY c."dia" DESC, c."hora" DESC`,
      params
    );
  }

  /**
   * Create an event
   */
  async create(data: Record<string, any>) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.map((c) => `"${c}"`).join(', ');

    return queryOne(
      `INSERT INTO "CALENDARIO" (${columnList}, "inscritos", "origen", "_createdDate", "_updatedDate")
       VALUES (${placeholders}, 0, 'POSTGRES', NOW(), NOW())
       RETURNING *`,
      values
    );
  }

  /**
   * Update event fields
   */
  async updateEvent(id: string, data: Record<string, any>, allowedFields: string[]) {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        const cast = (field === 'dia') ? '::timestamp with time zone' : '';
        updates.push(`"${field}" = $${idx}${cast}`);
        values.push(data[field]);
        idx++;
      }
    }

    if (updates.length === 0) return null;
    updates.push(`"_updatedDate" = NOW()`);
    values.push(id);

    return queryOne(
      `UPDATE "CALENDARIO"
       SET ${updates.join(', ')}
       WHERE "_id" = $${idx}
       RETURNING *`,
      values
    );
  }

  /**
   * Increment inscritos count
   */
  async incrementInscritos(eventId: string, count: number = 1) {
    await query(
      `UPDATE "CALENDARIO"
       SET "inscritos" = "inscritos" + $1, "_updatedDate" = NOW()
       WHERE "_id" = $2`,
      [count, eventId]
    );
  }

  /**
   * Decrement inscritos count (floor at 0)
   */
  async decrementInscritos(eventId: string) {
    await query(
      `UPDATE "CALENDARIO"
       SET "inscritos" = GREATEST("inscritos" - 1, 0), "_updatedDate" = NOW()
       WHERE "_id" = $1`,
      [eventId]
    );
  }

  /**
   * Get inscritos count for capacity check
   */
  async getInscritos(eventId: string): Promise<{ _id: string; inscritos: number } | null> {
    return queryOne(
      `SELECT "_id", "inscritos" FROM "CALENDARIO" WHERE "_id" = $1`,
      [eventId]
    );
  }

  // ── Dashboard helpers ──

  async countEventsInRange(startDate: string, endDate: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM "CALENDARIO"
       WHERE "dia" >= $1::timestamp AND "dia" <= $2::timestamp`,
      [startDate, endDate]
    );
    return parseInt(row?.count ?? '0', 10);
  }

  async countUniqueAdvisorsInRange(startDate: string, endDate: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT "advisor") as count FROM "CALENDARIO"
       WHERE "dia" >= $1::timestamp AND "dia" <= $2::timestamp`,
      [startDate, endDate]
    );
    return parseInt(row?.count ?? '0', 10);
  }
}

export const CalendarioRepository = new CalendarioRepositoryClass();
