/**
 * GET /api/postgres/reports/mensuales
 *
 * Reporte mensual de estadísticas académicas por nivel.
 *
 * Query params:
 *   startDate: ISO date string (e.g. "2026-03-01")
 *   endDate:   ISO date string (e.g. "2026-03-31")
 */

import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryMany } from '@/lib/postgres';

const NIVELES = `ARRAY['BN1','BN2','BN3','P1','P2','P3','F1','F2','F3']::text[]`;
const NIVELES_FILTER = `('BN1','BN2','BN3','P1','P2','P3','F1','F2','F3')`;
const NIVEL_ORDER = `ARRAY_POSITION(${NIVELES}, nivel)`;

async function safeQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<{ data: T; error?: string }> {
  try {
    return { data: await fn() };
  } catch (err: any) {
    console.error(`❌ [reports/mensuales] ${label}:`, err?.message || err);
    return { data: fallback, error: `${label}: ${err?.message || 'unknown error'}` };
  }
}

export const GET = handlerWithAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate   = searchParams.get('endDate');

  if (!startDate || !endDate) throw new ValidationError('startDate y endDate son requeridos');

  const s = `${startDate}T00:00:00`;
  const e = `${endDate}T23:59:59`;

  const [q1, q2, q3, q4, q5, q6, q7] = await Promise.all([

    // 1. CALENDARIO — Sesiones por nivel (BN1–F3)
    safeQuery('sesionesCalendario', () => queryMany(
      `SELECT nivel, COUNT(*)::int AS total
       FROM (
         SELECT COALESCE(c."nivel", '') AS nivel
         FROM "CALENDARIO" c
         WHERE c."dia" >= $1::timestamp AND c."dia" <= $2::timestamp
           AND c."tipo" = 'SESSION'
           AND COALESCE(c."nivel", '') IN ${NIVELES_FILTER}
       ) t
       GROUP BY nivel
       ORDER BY ${NIVEL_ORDER}`,
      [s, e]
    ), []),

    // 2. CALENDARIO — Clubes TRAINING por nivel
    safeQuery('trainingCalendario', () => queryMany(
      `SELECT nivel, COUNT(*)::int AS total
       FROM (
         SELECT COALESCE(c."nivel", '') AS nivel
         FROM "CALENDARIO" c
         WHERE c."dia" >= $1::timestamp AND c."dia" <= $2::timestamp
           AND c."tipo" = 'CLUB'
           AND COALESCE(c."nivel", '') IN ${NIVELES_FILTER}
           AND (
             c."club"         ILIKE 'TRAINING%'
             OR c."nombreEvento" ILIKE 'TRAINING%'
             OR c."tituloONivel" ILIKE 'TRAINING%'
           )
       ) t
       GROUP BY nivel
       ORDER BY ${NIVEL_ORDER}`,
      [s, e]
    ), []),

    // 3. CALENDARIO — JUMP sessions por nivel (step múltiplo de 5)
    safeQuery('jumpsCalendario', () => queryMany(
      `SELECT nivel, COUNT(*)::int AS total
       FROM (
         SELECT COALESCE(c."nivel", '') AS nivel
         FROM "CALENDARIO" c
         WHERE c."dia" >= $1::timestamp AND c."dia" <= $2::timestamp
           AND c."tipo" = 'SESSION'
           AND COALESCE(c."nivel", '') IN ${NIVELES_FILTER}
           AND NULLIF(REGEXP_REPLACE(COALESCE(c."step", ''), '[^0-9]', '', 'g'), '') IS NOT NULL
           AND NULLIF(REGEXP_REPLACE(COALESCE(c."step", ''), '[^0-9]', '', 'g'), '')::int > 0
           AND NULLIF(REGEXP_REPLACE(COALESCE(c."step", ''), '[^0-9]', '', 'g'), '')::int % 5 = 0
       ) t
       GROUP BY nivel
       ORDER BY ${NIVEL_ORDER}`,
      [s, e]
    ), []),

    // 4. ACADEMICA_BOOKINGS — Agendamientos sesiones por nivel
    safeQuery('sesionesBookings', () => queryMany(
      `SELECT nivel,
              COUNT(*)::int                                                               AS total,
              COUNT(*) FILTER (WHERE b."asistio" = true OR b."asistencia" = true)::int  AS asistieron,
              COUNT(*) FILTER (WHERE b."cancelo" = true)::int                           AS cancelados
       FROM (
         SELECT b.*,
                COALESCE(c."nivel", b."nivel") AS nivel
         FROM "ACADEMICA_BOOKINGS" b
         LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
         WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
           AND COALESCE(c."tipo", b."tipoEvento") = 'SESSION'
           AND COALESCE(c."nivel", b."nivel") IN ${NIVELES_FILTER}
       ) b
       GROUP BY nivel
       ORDER BY ${NIVEL_ORDER}`,
      [s, e]
    ), []),

    // 5. ACADEMICA_BOOKINGS — Agendamientos clubes TRAINING por nivel
    safeQuery('trainingBookings', () => queryMany(
      `SELECT nivel,
              COUNT(*)::int                                                              AS total,
              COUNT(*) FILTER (WHERE b."asistio" = true OR b."asistencia" = true)::int AS asistieron,
              COUNT(*) FILTER (WHERE b."cancelo" = true)::int                          AS cancelados
       FROM (
         SELECT b.*,
                COALESCE(c."nivel", b."nivel") AS nivel,
                COALESCE(c."nombreEvento", b."step", b."nombreEvento", '') AS nombre_evento
         FROM "ACADEMICA_BOOKINGS" b
         LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
         WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
           AND COALESCE(c."tipo", b."tipoEvento") = 'CLUB'
           AND COALESCE(c."nivel", b."nivel") IN ${NIVELES_FILTER}
       ) b
       WHERE nombre_evento ILIKE 'TRAINING%'
       GROUP BY nivel
       ORDER BY ${NIVEL_ORDER}`,
      [s, e]
    ), []),

    // 6. ACADEMICA_BOOKINGS — Agendamientos clubes NO TRAINING por clase y nivel
    safeQuery('otrosClubsBookings', () => queryMany(
      `SELECT clase, nivel, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE asistio = true OR asistencia = true)::int AS asistieron
       FROM (
         SELECT
           COALESCE(c."nombreEvento", b."step", b."nombreEvento", 'Sin nombre') AS clase,
           COALESCE(c."nivel", b."nivel") AS nivel,
           b."asistio", b."asistencia"
         FROM "ACADEMICA_BOOKINGS" b
         LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
         WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
           AND COALESCE(c."tipo", b."tipoEvento") = 'CLUB'
           AND COALESCE(c."nivel", b."nivel") IN ${NIVELES_FILTER}
           AND COALESCE(c."nombreEvento", b."step", b."nombreEvento", '') NOT ILIKE 'TRAINING%'
       ) t
       GROUP BY clase, nivel
       ORDER BY total DESC`,
      [s, e]
    ), []),

    // 7. ACADEMICA_BOOKINGS — Agendamientos sesiones y clubes por país
    safeQuery('bookingsPorPais', () => queryMany(
      `SELECT
         COALESCE(b."plataforma", p."plataforma", a."plataforma", 'Sin país') AS pais,
         COALESCE(c."tipo", b."tipoEvento")   AS tipo,
         COUNT(*)::int                        AS total,
         COUNT(*) FILTER (WHERE b."asistio" = true OR b."asistencia" = true)::int AS asistieron,
         COUNT(*) FILTER (WHERE b."cancelo" = true)::int AS cancelados
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
       LEFT JOIN "ACADEMICA" a ON COALESCE(b."studentId", b."idEstudiante") = a."_id"
       LEFT JOIN "PEOPLE" p ON a."numeroId" = p."numeroId" AND p."tipoUsuario" = 'BENEFICIARIO'
       WHERE b."fechaEvento" >= $1::timestamp AND b."fechaEvento" <= $2::timestamp
         AND COALESCE(c."tipo", b."tipoEvento") IN ('SESSION', 'CLUB')
       GROUP BY pais, tipo
       ORDER BY total DESC`,
      [s, e]
    ), []),
  ]);

  const errors = [q1,q2,q3,q4,q5,q6,q7].map(q=>q.error).filter(Boolean);

  return successResponse({
    filters: { startDate, endDate },
    sesionesCalendario:  q1.data,
    trainingCalendario:  q2.data,
    jumpsCalendario:     q3.data,
    sesionesBookings:    q4.data,
    trainingBookings:    q5.data,
    otrosClubsBookings:  q6.data,
    bookingsPorPais:     q7.data,
    ...(errors.length > 0 && { _errors: errors }),
  });
});
