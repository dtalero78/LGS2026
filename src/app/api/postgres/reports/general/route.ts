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

export const GET = handlerWithAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    throw new ValidationError('startDate y endDate son requeridos');
  }

  const startDateFull = `${startDate}T00:00:00`;
  const endDateFull   = `${endDate}T23:59:59`;

  // Run all queries in parallel; wrap complementarias separately to isolate errors
  const [
    resumenEventos,
    asistenciaPorPais,
    rendimientoAdvisors,
    usuariosPorPais,
  ] = await Promise.all([

    // 1. Resumen de eventos (SESSION + CLUB) desde CALENDARIO
    queryMany(
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
    ),

    // 2. Asistencia por país — JOIN via ACADEMICA para obtener plataforma correctamente
    queryMany(
      `SELECT
         COALESCE(p."plataforma", 'Sin país')            AS pais,
         COALESCE(c."tipo", b."tipoEvento")              AS tipo,
         COUNT(DISTINCT COALESCE(b."studentId", b."idEstudiante")) AS usuarios_distintos,
         COUNT(*) FILTER (
           WHERE b."asistio" = true OR b."asistencia" = true
         ) AS asistencias,
         COUNT(*) AS total_inscritos
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "CALENDARIO" c
         ON c."_id" = COALESCE(b."eventoId", b."idEvento")
       LEFT JOIN "ACADEMICA" a
         ON a."_id" = COALESCE(b."studentId", b."idEstudiante")
       LEFT JOIN "PEOPLE" p
         ON p."numeroId" = a."numeroId" AND p."tipoUsuario" = 'BENEFICIARIO'
       WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
         AND (b."cancelo" IS NULL OR b."cancelo" = false)
         AND COALESCE(c."tipo", b."tipoEvento") IN ('SESSION', 'CLUB')
       GROUP BY pais, tipo
       ORDER BY asistencias DESC`,
      [startDateFull, endDateFull]
    ),

    // 3. Rendimiento por advisor
    queryMany(
      `SELECT
         b."advisor",
         COUNT(*) AS agendados,
         COUNT(*) FILTER (
           WHERE b."asistio" = true OR b."asistencia" = true
         ) AS asistieron,
         COUNT(*) FILTER (
           WHERE b."asistio" = false
             AND (b."asistencia" IS NULL OR b."asistencia" = false)
             AND (b."cancelo" IS NULL OR b."cancelo" = false)
         ) AS ausentes,
         COUNT(*) FILTER (WHERE b."cancelo" = true) AS cancelados
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "CALENDARIO" c
         ON c."_id" = COALESCE(b."eventoId", b."idEvento")
       WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
         AND b."advisor" IS NOT NULL AND b."advisor" != ''
         AND COALESCE(c."tipo", b."tipoEvento") IN ('SESSION', 'CLUB')
       GROUP BY b."advisor"
       ORDER BY agendados DESC`,
      [startDateFull, endDateFull]
    ),

    // 4. Usuarios académicos activos/inactivos por país (estado actual)
    queryMany(
      `SELECT
         COALESCE(p."plataforma", 'Sin país') AS pais,
         COUNT(*) FILTER (WHERE p."estadoInactivo" IS DISTINCT FROM true) AS activos,
         COUNT(*) FILTER (WHERE p."estadoInactivo" = true)                AS inactivos,
         COUNT(*)                                                          AS total
       FROM "ACADEMICA" a
       JOIN "PEOPLE" p ON p."numeroId" = a."numeroId" AND p."tipoUsuario" = 'BENEFICIARIO'
       GROUP BY p."plataforma"
       ORDER BY total DESC`,
      []
    ),
  ]);

  // Complementarias in a separate try-catch to avoid bringing down the whole report
  let complementarias = { totalSolicitadas: 0, aprobadas: 0, reprobadas: 0, enProgreso: 0 };
  try {
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
    if (row) {
      complementarias = {
        totalSolicitadas: parseInt((row as any).total_solicitadas) || 0,
        aprobadas:        parseInt((row as any).aprobadas)         || 0,
        reprobadas:       parseInt((row as any).reprobadas)        || 0,
        enProgreso:       parseInt((row as any).en_progreso)       || 0,
      };
    }
  } catch {
    // Table may not exist in all environments — return zeros
  }

  // Normalize types
  const normResumen = (resumenEventos as any[]).map((r) => ({
    tipo:          r.tipo,
    totalEventos:  parseInt(r.total_eventos)  || 0,
    totalInscritos: parseInt(r.total_inscritos) || 0,
    asistieron:    parseInt(r.asistieron)     || 0,
    cancelados:    parseInt(r.cancelados)     || 0,
  }));

  const normAsistenciaPorPais = (asistenciaPorPais as any[]).map((r) => ({
    pais:             r.pais,
    tipo:             r.tipo,
    usuariosDistintos: parseInt(r.usuarios_distintos) || 0,
    asistencias:      parseInt(r.asistencias)         || 0,
    totalInscritos:   parseInt(r.total_inscritos)     || 0,
  }));

  const normAdvisors = (rendimientoAdvisors as any[]).map((r) => {
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

  const normUsuariosPorPais = (usuariosPorPais as any[]).map((r) => ({
    pais:      r.pais,
    activos:   parseInt(r.activos)   || 0,
    inactivos: parseInt(r.inactivos) || 0,
    total:     parseInt(r.total)     || 0,
  }));

  return successResponse({
    filters: { startDate, endDate },
    resumenEventos:     normResumen,
    complementarias,
    asistenciaPorPais:  normAsistenciaPorPais,
    rendimientoAdvisors: normAdvisors,
    usuariosPorPais:    normUsuariosPorPais,
  });
});
