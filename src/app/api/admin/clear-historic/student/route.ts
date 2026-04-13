import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { queryOne } from '@/lib/postgres'
import { ForbiddenError, ValidationError } from '@/lib/errors'

/** Run a DELETE CTE and return the deleted count, or 0 if the table doesn't exist */
async function safeDelete(sql: string, params: any[]): Promise<number> {
  try {
    const row = await queryOne<{ count: string }>(sql, params)
    return parseInt(row?.count ?? '0', 10)
  } catch (err: any) {
    // Table might not exist in local dev — return 0 instead of crashing
    console.warn('[clear-historic/student] safeDelete error:', err.message)
    return 0
  }
}

export const DELETE = handlerWithAuth(async (req, session) => {
  if (session.user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede ejecutar operaciones de limpieza')
  }

  const body = await req.json()
  const { academicaIds, numeroId } = body as { academicaIds?: string[]; numeroId?: string }

  if (!academicaIds || academicaIds.length === 0) {
    throw new ValidationError('academicaIds es requerido')
  }
  if (!numeroId) {
    throw new ValidationError('numeroId es requerido')
  }

  // Delete ACADEMICA_BOOKINGS (excluding WELCOME records)
  const bookingsDeleted = await safeDelete(
    `WITH del AS (
      DELETE FROM "ACADEMICA_BOOKINGS"
      WHERE COALESCE("studentId", "idEstudiante") = ANY($1::text[])
        AND "nivel" IS DISTINCT FROM 'WELCOME'
        AND ("step" IS NULL OR "step" NOT ILIKE '%WELCOME%')
        AND COALESCE("tipoEvento", "tipo") IS DISTINCT FROM 'WELCOME'
        AND ("tituloONivel" IS NULL OR "tituloONivel" NOT ILIKE '%WELCOME%')
        AND ("nombreEvento" IS NULL OR "nombreEvento" NOT ILIKE '%WELCOME%')
      RETURNING 1
    ) SELECT COUNT(*)::text AS count FROM del`,
    [academicaIds]
  )

  // Delete COMPLEMENTARIA_ATTEMPTS
  const complementariaDeleted = await safeDelete(
    `WITH del AS (
      DELETE FROM "COMPLEMENTARIA_ATTEMPTS"
      WHERE "studentId" = ANY($1::text[])
      RETURNING 1
    ) SELECT COUNT(*)::text AS count FROM del`,
    [academicaIds]
  )

  // Delete STEP_OVERRIDES (studentId = ACADEMICA _id per CLAUDE.md)
  const stepOverridesDeleted = await safeDelete(
    `WITH del AS (
      DELETE FROM "STEP_OVERRIDES"
      WHERE "studentId" = ANY($1::text[])
      RETURNING 1
    ) SELECT COUNT(*)::text AS count FROM del`,
    [academicaIds]
  )

  return successResponse({
    deleted: {
      bookings: bookingsDeleted,
      complementaria: complementariaDeleted,
      stepOverrides: stepOverridesDeleted,
    },
  })
})
