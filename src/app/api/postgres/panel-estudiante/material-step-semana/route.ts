import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { NivelLibroBindingRepository } from '@/repositories/libros-interactivos.repository';
import { queryOne } from '@/lib/postgres';
import { tzForPlataforma } from '@/lib/timezone';

/**
 * GET /api/postgres/panel-estudiante/material-step-semana
 *
 * Para el botón "Ir a mi Step de esta semana" del visor de material interactivo.
 * Busca la SESIÓN agendada del estudiante en la SEMANA CORRIENTE (Lun–Dom en su
 * zona horaria), toma su nivel+step, y resuelve la página LOCAL donde empieza
 * ese step en el libro (NIVELES.libroPaginaStep).
 *
 * Solo cuenta SESSION (steps "Step N" — incluye JUMP; excluye TRAINING/CLUB).
 *
 * Respuesta:
 *  { available: true, nivel, step, paginaLocal }        → hay sesión + página configurada
 *  { available: false, reason: 'no-session'|'no-page', nivel?, step? }
 */
export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  const student = await resolveStudentFromSession(session);
  const academicaId = student.academicaId || student._id;
  if (!academicaId) return successResponse({ available: false, reason: 'no-session' });

  const tz = tzForPlataforma((student as any).plataforma);

  // Sesión (SESSION) agendada esta semana (Lun–Dom en TZ del estudiante).
  // Prefiere la próxima que viene; si no, la más reciente de la semana.
  const row = await queryOne<{ nivel: string | null; step: string | null }>(
    `SELECT COALESCE(c."nivel", b."nivel") AS "nivel",
            COALESCE(c."step",  b."step")  AS "step"
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
      WHERE (b."studentId" = $1 OR b."idEstudiante" = $1)
        AND b."cancelo" IS NOT TRUE
        AND COALESCE(c."step", b."step") ~ '^Step [0-9]+$'
        AND (b."fechaEvento" AT TIME ZONE $2) >= date_trunc('week', (now() AT TIME ZONE $2))
        AND (b."fechaEvento" AT TIME ZONE $2) <  date_trunc('week', (now() AT TIME ZONE $2)) + interval '7 days'
      ORDER BY (b."fechaEvento" >= now()) DESC, b."fechaEvento" ASC
      LIMIT 1`,
    [academicaId, tz]
  );

  if (!row || !row.nivel || !row.step) {
    return successResponse({ available: false, reason: 'no-session' });
  }

  const paginaLocal = await NivelLibroBindingRepository.getStepPagina(row.nivel, row.step);
  if (!paginaLocal || paginaLocal < 1) {
    return successResponse({ available: false, reason: 'no-page', nivel: row.nivel, step: row.step });
  }

  return successResponse({ available: true, nivel: row.nivel, step: row.step, paginaLocal });
});
