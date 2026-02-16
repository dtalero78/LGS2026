/**
 * Booking Repository
 *
 * All SQL for the ACADEMICA_BOOKINGS table (~8 route handlers).
 */

import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { BaseRepository } from './base.repository';
import { buildDynamicUpdate } from '@/lib/query-builder';

class BookingRepositoryClass extends BaseRepository {
  constructor() {
    super('ACADEMICA_BOOKINGS');
  }

  /**
   * Get bookings for an event with student details from PEOPLE
   */
  async findByEventIdWithStudents(eventId: string, limit: number = 200) {
    return queryMany(
      `SELECT ab."_id", ab."studentId", ab."eventoId", ab."tipo", ab."fecha", ab."hora",
              ab."advisor", ab."nivel", ab."step", ab."asistencia", ab."asistio",
              ab."participacion", ab."noAprobo", ab."cancelo", ab."calificacion",
              ab."anotaciones", ab."comentarios", ab."advisorAnotaciones", ab."actividadPropuesta",
              ab."linkZoom", ab."asignadoPor", ab."origen", ab."agendadoPor",
              ab."agendadoPorEmail", ab."agendadoPorRol", ab."fechaAgendamiento",
              ab."fechaEvento", ab."tipoEvento", ab."nombreEvento", ab."tituloONivel",
              ab."_createdDate", ab."_updatedDate",
              p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido",
              p."email", p."celular", p."numeroId", p."tipoUsuario"
       FROM "ACADEMICA_BOOKINGS" ab
       LEFT JOIN "PEOPLE" p ON ab."studentId" = p."_id"
       WHERE ab."eventoId" = $1
       ORDER BY p."primerNombre" ASC, p."primerApellido" ASC
       LIMIT $2`,
      [eventId, limit]
    );
  }

  /**
   * Get bookings for a calendar event (simple, no JOIN)
   */
  async findByEventId(eventId: string) {
    return queryMany(
      `SELECT * FROM "ACADEMICA_BOOKINGS"
       WHERE "eventoId" = $1 OR "idEvento" = $1
       ORDER BY "primerApellido", "primerNombre"`,
      [eventId]
    );
  }

  /**
   * Get bookings with extended student info
   */
  async findByEventIdWithStudentDetails(eventId: string) {
    return queryMany(
      `SELECT b.*, p."email" as "studentEmail", p."plataforma" as "studentPlataforma",
              p."estadoInactivo" as "studentInactivo", p."vigencia" as "studentVigencia",
              p."finalContrato" as "studentFinalContrato"
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "PEOPLE" p ON b."idEstudiante" = p."_id"
       WHERE b."eventoId" = $1 OR b."idEvento" = $1
       ORDER BY b."primerApellido", b."primerNombre"`,
      [eventId]
    );
  }

  /**
   * Get a student's class history
   */
  async findByStudentId(studentId: string, limit: number = 500) {
    return queryMany(
      `SELECT "_id", "studentId", "eventoId", "tipo", "fecha", "hora", "advisor",
              "nivel", "step", "asistencia", "asistio", "participacion", "noAprobo",
              "cancelo", "calificacion", "anotaciones", "comentarios", "advisorAnotaciones",
              "actividadPropuesta", "linkZoom", "asignadoPor", "origen",
              "agendadoPor", "agendadoPorEmail", "agendadoPorRol",
              "fechaAgendamiento", "fechaEvento", "tipoEvento", "nombreEvento", "tituloONivel",
              "_createdDate", "_updatedDate"
       FROM "ACADEMICA_BOOKINGS"
       WHERE ("idEstudiante" = $1 OR "studentId" = $1)
       ORDER BY "fecha" DESC, "hora" DESC
       LIMIT $2`,
      [studentId, limit]
    );
  }

  /**
   * Classes attended by nivel (for progress calculation)
   */
  async countClassesByStep(studentId: string, nivel: string) {
    return queryMany<{ step: string; totalClases: string }>(
      `SELECT DISTINCT "step", COUNT(*) as "totalClases"
       FROM "ACADEMICA_BOOKINGS"
       WHERE ("idEstudiante" = $1 OR "studentId" = $1)
         AND "nivel" = $2
         AND "asistio" = true
       GROUP BY "step"`,
      [studentId, nivel]
    );
  }

  /**
   * Mark single attendance
   */
  async markAttendance(bookingId: string, asistio: boolean, fecha?: string) {
    return queryOne(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET "asistio" = $1,
           "asistencia" = $1,
           "fecha" = COALESCE($2::timestamp with time zone, NOW()),
           "_updatedDate" = NOW()
       WHERE "_id" = $3
       RETURNING *`,
      [asistio, fecha || null, bookingId]
    );
  }

  /**
   * Bulk attendance update
   */
  async markAttendanceBulk(bookings: { bookingId: string; asistio: boolean }[]) {
    const results = [];
    for (const b of bookings) {
      if (!b.bookingId || b.asistio === undefined) continue;
      const result = await query(
        `UPDATE "ACADEMICA_BOOKINGS"
         SET "asistio" = $1, "asistencia" = $1, "fecha" = NOW(), "_updatedDate" = NOW()
         WHERE "_id" = $2
         RETURNING "_id", "asistio", "primerNombre", "primerApellido"`,
        [b.asistio, b.bookingId]
      );
      if (result.rowCount && result.rowCount > 0) {
        results.push(result.rows[0]);
      }
    }
    return results;
  }

  /**
   * Update booking fields (evaluation, comments, etc.)
   */
  async updateFields(bookingId: string, body: Record<string, any>, allowedFields: string[]) {
    const built = buildDynamicUpdate('ACADEMICA_BOOKINGS', body, allowedFields);
    if (!built) return null;
    built.values.push(bookingId);
    return queryOne(built.query, built.values);
  }

  /**
   * Enroll a student in an event
   */
  async createEnrollment(data: Record<string, any>) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.map((c) => `"${c}"`).join(', ');

    return queryOne(
      `INSERT INTO "ACADEMICA_BOOKINGS" (${columnList}, "_createdDate", "_updatedDate")
       VALUES (${placeholders}, NOW(), NOW())
       RETURNING *`,
      values
    );
  }

  /**
   * Delete a single booking (unenroll)
   */
  async deleteEnrollment(bookingId: string) {
    const result = await query(
      `DELETE FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
      [bookingId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all bookings for an event
   */
  async deleteByEventId(eventId: string) {
    const result = await query(
      `DELETE FROM "ACADEMICA_BOOKINGS"
       WHERE "eventoId" = $1 OR "idEvento" = $1
       RETURNING "_id"`,
      [eventId]
    );
    return result.rows;
  }

  /**
   * Get booking counts for multiple events in a single query
   */
  async getBatchCounts(eventIds: string[]) {
    return queryMany(
      `SELECT
        COALESCE(b."eventoId", b."idEvento") as "eventId",
        COUNT(*) as "total",
        COUNT(CASE WHEN b."asistio" = true THEN 1 END) as "asistencias",
        COUNT(CASE WHEN b."asistio" = false THEN 1 END) as "ausencias",
        COUNT(CASE WHEN b."asistio" IS NULL THEN 1 END) as "pendientes"
      FROM "ACADEMICA_BOOKINGS" b
      WHERE b."eventoId" = ANY($1::text[]) OR b."idEvento" = ANY($1::text[])
      GROUP BY COALESCE(b."eventoId", b."idEvento")`,
      [eventIds]
    );
  }

  // ── Dashboard helpers ──

  /**
   * Top students by attendance in a period
   */
  async topStudentsByAttendance(sinceDate: string, limit: number = 5) {
    return queryMany(
      `SELECT b."primerNombre", b."primerApellido", b."nivel", p."plataforma",
              COUNT(*) as asistencias
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "PEOPLE" p ON b."idEstudiante" = p."_id"
       WHERE b."asistio" = true
         AND b."fechaEvento" >= $1::timestamp
       GROUP BY b."primerNombre", b."primerApellido", b."nivel", p."plataforma"
       ORDER BY asistencias DESC
       LIMIT $2`,
      [sinceDate, limit]
    );
  }

  /**
   * Count enrollments in a date range
   */
  async countEnrollmentsInRange(startDate: string, endDate: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM "ACADEMICA_BOOKINGS"
       WHERE "fechaEvento" >= $1::timestamp AND "fechaEvento" <= $2::timestamp`,
      [startDate, endDate]
    );
    return parseInt(row?.count ?? '0', 10);
  }

  /**
   * Get WELCOME bookings with student details for the welcome-session page.
   * Returns one row per student booking (not per event).
   */
  async findWelcomeBookings(startDate?: string, endDate?: string) {
    const conditions = [`COALESCE(c."tipo", c."evento") = 'WELCOME'`];
    const params: any[] = [];
    let paramIdx = 1;

    if (startDate) {
      conditions.push(`c."dia" >= $${paramIdx}::timestamp`);
      params.push(startDate);
      paramIdx++;
    }
    if (endDate) {
      conditions.push(`c."dia" < $${paramIdx}::timestamp`);
      params.push(endDate);
      paramIdx++;
    }

    return queryMany(
      `SELECT
         ab."_id",
         COALESCE(ab."primerNombre", p."primerNombre", '') as "primerNombre",
         COALESCE(ab."primerApellido", p."primerApellido", '') as "primerApellido",
         COALESCE(p."segundoNombre", '') as "segundoNombre",
         COALESCE(p."segundoApellido", '') as "segundoApellido",
         COALESCE(p."celular", '') as "celular",
         c."dia" as "fechaEvento",
         ab."asistio" as "asistencia",
         COALESCE(p."numeroId", '') as "numeroId",
         ab."studentId" as "idEstudiante",
         ab."nivel",
         ab."advisor",
         COALESCE(p."plataforma", '') as "plataforma",
         COUNT(*) OVER (PARTITION BY ab."studentId") as "totalSesionesWelcome"
       FROM "CALENDARIO" c
       INNER JOIN "ACADEMICA_BOOKINGS" ab ON c."_id" = ab."eventoId"
       LEFT JOIN "PEOPLE" p ON ab."studentId" = p."_id"
       WHERE ${conditions.join(' AND ')}
       ORDER BY c."dia" DESC, ab."primerApellido" ASC, ab."primerNombre" ASC`,
      params
    );
  }
  // ── Panel Estudiante helpers ──

  async findUpcomingByStudentId(studentId: string, limit: number = 10) {
    return queryMany(
      `SELECT ab.*,
              a."nombreCompleto" as "advisorNombre",
              c."linkZoom" as "eventLinkZoom"
       FROM "ACADEMICA_BOOKINGS" ab
       LEFT JOIN "ADVISORS" a ON ab."advisor" = a."_id"
       LEFT JOIN "CALENDARIO" c ON COALESCE(ab."eventoId", ab."idEvento") = c."_id"
       WHERE (ab."idEstudiante" = $1 OR ab."studentId" = $1)
         AND ab."cancelo" = false
         AND ab."fechaEvento" >= NOW()
       ORDER BY ab."fechaEvento" ASC
       LIMIT $2`,
      [studentId, limit]
    );
  }

  async getStudentAttendanceStats(studentId: string) {
    return queryOne(
      `SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN "asistio" = true THEN 1 END)::int as asistencias,
        COUNT(CASE WHEN "asistio" = false AND "cancelo" = false THEN 1 END)::int as ausencias,
        COUNT(CASE WHEN "cancelo" = true THEN 1 END)::int as canceladas
       FROM "ACADEMICA_BOOKINGS"
       WHERE ("idEstudiante" = $1 OR "studentId" = $1)`,
      [studentId]
    );
  }

  async findCommentsForStudent(studentId: string, limit: number = 50) {
    return queryMany(
      `SELECT ab."_id", ab."fechaEvento", ab."nivel", ab."step", ab."advisor",
              ab."advisorAnotaciones", ab."comentarios", ab."calificacion",
              a."nombreCompleto" as "advisorNombre"
       FROM "ACADEMICA_BOOKINGS" ab
       LEFT JOIN "ADVISORS" a ON ab."advisor" = a."_id"
       WHERE (ab."idEstudiante" = $1 OR ab."studentId" = $1)
         AND (ab."advisorAnotaciones" IS NOT NULL AND ab."advisorAnotaciones" != ''
              OR ab."comentarios" IS NOT NULL AND ab."comentarios" != '')
       ORDER BY ab."fechaEvento" DESC
       LIMIT $2`,
      [studentId, limit]
    );
  }

  async countWeeklyBookingsByType(studentId: string, weekStart: string, weekEnd: string) {
    return queryMany(
      `SELECT COALESCE("tipo", "tipoEvento") as tipo, COUNT(*)::int as count
       FROM "ACADEMICA_BOOKINGS"
       WHERE ("idEstudiante" = $1 OR "studentId" = $1)
         AND "fechaEvento" >= $2::timestamp
         AND "fechaEvento" <= $3::timestamp
         AND "cancelo" = false
       GROUP BY COALESCE("tipo", "tipoEvento")`,
      [studentId, weekStart, weekEnd]
    );
  }

  async existsByStudentAndEvent(studentId: string, eventId: string): Promise<boolean> {
    const row = await queryOne(
      `SELECT 1 FROM "ACADEMICA_BOOKINGS"
       WHERE ("idEstudiante" = $1 OR "studentId" = $1)
         AND ("eventoId" = $2 OR "idEvento" = $2)
         AND "cancelo" = false
       LIMIT 1`,
      [studentId, eventId]
    );
    return !!row;
  }

  async existsSameDaySession(studentId: string, dateStr: string): Promise<boolean> {
    const row = await queryOne(
      `SELECT 1 FROM "ACADEMICA_BOOKINGS"
       WHERE ("idEstudiante" = $1 OR "studentId" = $1)
         AND DATE("fechaEvento") = $2::date
         AND COALESCE("tipo", "tipoEvento") = 'SESSION'
         AND "cancelo" = false
       LIMIT 1`,
      [studentId, dateStr]
    );
    return !!row;
  }

  async findBookingById(bookingId: string) {
    return queryOne(
      `SELECT * FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
      [bookingId]
    );
  }

  async cancelBooking(bookingId: string) {
    return queryOne(
      `UPDATE "ACADEMICA_BOOKINGS"
       SET "cancelo" = true, "_updatedDate" = NOW()
       WHERE "_id" = $1
       RETURNING *`,
      [bookingId]
    );
  }
}

export const BookingRepository = new BookingRepositoryClass();
