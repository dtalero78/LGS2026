import 'server-only';
import { query } from '@/lib/postgres';
import { ids } from '@/lib/id-generator';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { dentroVentanaIngreso, zoomLimites } from '@/lib/zoom-window';

/**
 * Registro del acceso a Zoom del alumno (bitácora `ZOOM_ACCESOS`).
 *
 * Sirve para dos cosas:
 *  1. Trazabilidad — queda quién pulsó el ícono, a qué clase y a qué hora.
 *  2. Reconexión — quien generó el acceso dentro de la ventana de ingreso
 *     conserva el ícono hasta 10 min antes de que termine la clase, para volver a
 *     entrar si se le cae la conexión. Es un derecho PERSONAL, así que vive en un
 *     dato guardado y no en un cálculo de reloj: quien no alcanzó a entrar no lo
 *     tiene, y a quien sí, un F5 no se lo quita.
 *
 * El alumno sale SIEMPRE de la sesión; el cliente sólo dice a qué clase entra.
 */
export interface ZoomAccesoInput {
  eventoId: string;
  ip?: string | null;
  userAgent?: string | null;
}
export interface ZoomAccesoResult {
  /** Primer acceso del alumno a ESA clase (ISO). Es el que abre la reconexión. */
  accesoEn: string;
  /** Cuántas veces ha entrado, contando ésta. */
  veces: number;
  /** Instante hasta el que le queda activo el ícono (ISO). */
  reconexionHasta: string;
}

export async function registrarAccesoZoom(
  academicaId: string,
  input: ZoomAccesoInput,
): Promise<ZoomAccesoResult> {
  const eventoId = String(input.eventoId || '').trim();
  if (!eventoId) throw new ValidationError('Falta el evento.');

  // El agendamiento del ALUMNO en ESE evento: si no lo tiene, no es su clase.
  const bk = (await query<any>(
    `SELECT b."_id" AS "bookingId", b."fechaEvento",
            c."tipo", c."nivel", c."step", c."nombreEvento",
            a."numeroId",
            TRIM(CONCAT_WS(' ', a."primerNombre", a."primerApellido")) AS nombre
       FROM "ACADEMICA_BOOKINGS" b
       JOIN "CALENDARIO" c ON c."_id" = $2
       LEFT JOIN "ACADEMICA" a ON a."_id" = $1
      WHERE (b."idEstudiante" = $1 OR b."studentId" = $1)
        AND (b."eventoId" = $2 OR b."idEvento" = $2)
        AND b."cancelo" IS NOT TRUE
      LIMIT 1`,
    [academicaId, eventoId],
  )).rows[0];
  if (!bk) throw new NotFoundError('No tienes esta clase agendada.');

  const inicioMs = new Date(bk.fechaEvento).getTime();
  const { cierraReconexion } = zoomLimites(inicioMs, bk.tipo);

  // Primer acceso previo del alumno a este evento (abre la reconexión) + conteo.
  const previo = (await query<{ primero: Date | null; veces: number }>(
    `SELECT MIN("_createdDate") AS primero, COUNT(*)::int AS veces
       FROM "ZOOM_ACCESOS"
      WHERE "academicaId" = $1 AND ("eventoId" = $2 OR "fechaEvento" = $3)`,
    [academicaId, eventoId, bk.fechaEvento],
  )).rows[0];

  const ahora = Date.now();
  const yaTeniaAcceso = !!previo?.primero;
  // Admite el clic dentro de la ventana de ingreso, o volver a entrar si ya tenía
  // acceso y sigue dentro de la reconexión (eso NO extiende nada, sólo bitácora).
  const puede = dentroVentanaIngreso(inicioMs, ahora)
    || (yaTeniaAcceso && ahora <= cierraReconexion);
  if (!puede) {
    throw new ValidationError(
      ahora < inicioMs
        ? 'Todavía no es hora de esta clase.'
        : 'El plazo para ingresar a esta clase ya venció.',
    );
  }

  await query(
    `INSERT INTO "ZOOM_ACCESOS"
       ("_id","academicaId","numeroId","nombre","bookingId","eventoId","fechaEvento",
        "nivel","step","tipo","minutosDesdeInicio","ip","userAgent")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [ids.audit(), academicaId, bk.numeroId || null, bk.nombre || null,
     bk.bookingId, eventoId, bk.fechaEvento, bk.nivel || null, bk.step || null, bk.tipo || null,
     Math.round((ahora - inicioMs) / 60_000),
     // `x-forwarded-for` llega encadenado por los proxies y la columna es acotada.
     (input.ip || '').slice(0, 45) || null, (input.userAgent || '').slice(0, 300) || null],
  );

  return {
    accesoEn: (previo?.primero ? new Date(previo.primero) : new Date(ahora)).toISOString(),
    veces: (previo?.veces || 0) + 1,
    reconexionHasta: new Date(cierraReconexion).toISOString(),
  };
}
