/**
 * GET /api/postgres/reports/general
 *
 * Reporte general de gestión: eventos, asistencia por país,
 * rendimiento por advisor, y estado de usuarios por país.
 *
 * Query params:
 *   startDate: ISO date string (e.g. "2026-01-01")
 *   endDate:   ISO date string (e.g. "2026-03-31")
 */

import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryMany, queryOne } from '@/lib/postgres';

async function safeQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<{ data: T; error?: string }> {
  try {
    const data = await fn();
    return { data };
  } catch (err: any) {
    console.error(`❌ [reports/general] ${label}:`, err?.message || err);
    return { data: fallback, error: `${label}: ${err?.message || 'unknown error'}` };
  }
}

export const GET = handlerWithAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate   = searchParams.get('endDate');

  if (!startDate || !endDate) {
    throw new ValidationError('startDate y endDate son requeridos');
  }

  const startDateFull = `${startDate}T00:00:00`;
  const endDateFull   = `${endDate}T23:59:59`;

  // Run all sections in parallel, each isolated so one failure doesn't kill the rest
  const [
    q1,
    q2,
    q3,
    q4,
    q5,
  ] = await Promise.all([

    // 1. Resumen de eventos (SESSION + CLUB) desde CALENDARIO
    safeQuery('resumenEventos', () => queryMany(
      `SELECT
         c."tipo",
         COUNT(DISTINCT c."_id") AS total_eventos,
         COUNT(b."_id") FILTER (WHERE b."cancelo" IS DISTINCT FROM true) AS total_inscritos,
         COUNT(b."_id") FILTER (
           WHERE (b."asistio" = true OR b."asistencia" = true)
             AND b."cancelo" IS DISTINCT FROM true
         ) AS asistieron,
         COUNT(b."_id") FILTER (WHERE b."cancelo" = true) AS cancelados
       FROM "CALENDARIO" c
       LEFT JOIN "ACADEMICA_BOOKINGS" b
         ON (b."eventoId" = c."_id" OR b."idEvento" = c."_id")
       WHERE c."dia" >= $1::timestamp AND c."dia" <= $2::timestamp
         AND c."tipo" IN ('SESSION', 'CLUB')
       GROUP BY c."tipo"
       ORDER BY c."tipo"`,
      [startDateFull, endDateFull]
    ), []),

    // 2. Complementarias (COMPLEMENTARIA_ATTEMPTS)
    safeQuery('complementarias', async () => {
      const row = await queryOne(
        `SELECT
           COUNT(*) AS total_solicitadas,
           COUNT(*) FILTER (WHERE status = 'PASSED')      AS aprobadas,
           COUNT(*) FILTER (WHERE status = 'FAILED')      AS reprobadas,
           COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS en_progreso
         FROM "COMPLEMENTARIA_ATTEMPTS"
         WHERE "_createdDate" >= $1::timestamp AND "_createdDate" <= $2::timestamp`,
        [startDateFull, endDateFull]
      );
      return row;
    }, null),

    // 3. Asistencia por país — usa b."plataforma" directamente (ya sincronizado en ACADEMICA_BOOKINGS)
    safeQuery('asistenciaPorPais', () => queryMany(
      `SELECT
         COALESCE(b."plataforma", 'Sin país')                               AS pais,
         COALESCE(c."tipo", b."tipoEvento")                                 AS tipo,
         COUNT(DISTINCT COALESCE(b."studentId", b."idEstudiante"))          AS usuarios_distintos,
         COUNT(*) FILTER (WHERE b."asistio" = true OR b."asistencia" = true) AS asistencias,
         COUNT(*)                                                            AS total_inscritos
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "CALENDARIO" c
         ON c."_id" = COALESCE(b."eventoId", b."idEvento")
       WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
         AND (b."cancelo" IS NULL OR b."cancelo" = false)
         AND COALESCE(c."tipo", b."tipoEvento") IN ('SESSION', 'CLUB')
       GROUP BY pais, tipo
       ORDER BY asistencias DESC`,
      [startDateFull, endDateFull]
    ), []),

    // 4. Rendimiento por advisor — JOIN ADVISORS para obtener nombreCompleto
    safeQuery('rendimientoAdvisors', () => queryMany(
      `SELECT
         COALESCE(adv."nombreCompleto", b."advisor") AS advisor,
         COUNT(*) AS agendados,
         COUNT(*) FILTER (WHERE b."asistio" = true OR b."asistencia" = true) AS asistieron,
         COUNT(*) FILTER (
           WHERE b."asistio" = false
             AND (b."asistencia" IS NULL OR b."asistencia" = false)
             AND (b."cancelo" IS NULL OR b."cancelo" = false)
         ) AS ausentes,
         COUNT(*) FILTER (WHERE b."cancelo" = true) AS cancelados
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "ADVISORS" adv ON adv."_id" = b."advisor"
       LEFT JOIN "CALENDARIO" c
         ON c."_id" = COALESCE(b."eventoId", b."idEvento")
       WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
         AND b."advisor" IS NOT NULL AND b."advisor" != ''
         AND COALESCE(c."tipo", b."tipoEvento") IN ('SESSION', 'CLUB')
       GROUP BY b."advisor", adv."nombreCompleto"
       ORDER BY agendados DESC`,
      [startDateFull, endDateFull]
    ), []),

    // 5. Usuarios académicos activos/inactivos por país (estado actual)
    safeQuery('usuariosPorPais', () => queryMany(
      `SELECT
         COALESCE(p."plataforma", 'Sin país')                             AS pais,
         COUNT(*) FILTER (WHERE p."estadoInactivo" IS DISTINCT FROM true) AS activos,
         COUNT(*) FILTER (WHERE p."estadoInactivo" = true)                AS inactivos,
         COUNT(*)                                                          AS total
       FROM "ACADEMICA" a
       JOIN "PEOPLE" p ON p."numeroId" = a."numeroId" AND p."tipoUsuario" = 'BENEFICIARIO'
       GROUP BY p."plataforma"
       ORDER BY total DESC`,
      []
    ), []),
  ]);

  // Collect any section errors for debugging (visible in response, not thrown)
  const sectionErrors = [q1, q2, q3, q4, q5]
    .map(q => q.error)
    .filter(Boolean);

  // Normalize resumenEventos
  const normResumen = (q1.data as any[]).map((r) => ({
    tipo:           r.tipo,
    totalEventos:   parseInt(r.total_eventos)   || 0,
    totalInscritos: parseInt(r.total_inscritos)  || 0,
    asistieron:     parseInt(r.asistieron)       || 0,
    cancelados:     parseInt(r.cancelados)       || 0,
  }));

  // Normalize complementarias
  const compRow = q2.data as any;
  const normComplementarias = {
    totalSolicitadas: parseInt(compRow?.total_solicitadas) || 0,
    aprobadas:        parseInt(compRow?.aprobadas)         || 0,
    reprobadas:       parseInt(compRow?.reprobadas)        || 0,
    enProgreso:       parseInt(compRow?.en_progreso)       || 0,
  };

  // Normalize asistencia por país
  const normAsistenciaPorPais = (q3.data as any[]).map((r) => ({
    pais:              r.pais,
    tipo:              r.tipo,
    usuariosDistintos: parseInt(r.usuarios_distintos) || 0,
    asistencias:       parseInt(r.asistencias)         || 0,
    totalInscritos:    parseInt(r.total_inscritos)      || 0,
  }));

  // Normalize advisors
  const normAdvisors = (q4.data as any[]).map((r) => {
    const agendados  = parseInt(r.agendados)  || 0;
    const asistieron = parseInt(r.asistieron) || 0;
    return {
      advisor:              r.advisor,
      agendados,
      asistieron,
      ausentes:             parseInt(r.ausentes)   || 0,
      cancelados:           parseInt(r.cancelados) || 0,
      porcentajeAsistencia: agendados > 0 ? Math.round((asistieron / agendados) * 100) : 0,
    };
  });

  // Normalize usuarios por país
  const normUsuariosPorPais = (q5.data as any[]).map((r) => ({
    pais:      r.pais,
    activos:   parseInt(r.activos)   || 0,
    inactivos: parseInt(r.inactivos) || 0,
    total:     parseInt(r.total)     || 0,
  }));

  return successResponse({
    filters: { startDate, endDate },
    resumenEventos:      normResumen,
    complementarias:     normComplementarias,
    asistenciaPorPais:   normAsistenciaPorPais,
    rendimientoAdvisors: normAdvisors,
    usuariosPorPais:     normUsuariosPorPais,
    ...(sectionErrors.length > 0 && { _errors: sectionErrors }),
  });
});
