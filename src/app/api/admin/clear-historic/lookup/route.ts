import 'server-only'
import { handlerWithAuth, successResponse } from '@/lib/api-helpers'
import { queryOne, queryMany } from '@/lib/postgres'
import { ForbiddenError, ValidationError } from '@/lib/errors'

export const GET = handlerWithAuth(async (req, session) => {
  if (session.user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Solo SUPER_ADMIN puede ejecutar operaciones de limpieza')
  }

  const { searchParams } = new URL(req.url)
  const numeroId = searchParams.get('numeroId')?.trim()

  if (!numeroId) {
    throw new ValidationError('numeroId es requerido')
  }

  // Check PEOPLE
  const peopleRows = await queryMany<{
    _id: string
    primerNombre: string
    primerApellido: string
    tipoUsuario: string
  }>(
    `SELECT "_id", "primerNombre", "primerApellido", "tipoUsuario"
     FROM "PEOPLE"
     WHERE "numeroId" = $1`,
    [numeroId]
  )

  // Check ACADEMICA
  const academicaRows = await queryMany<{
    _id: string
    nivel: string
    step: string
  }>(
    `SELECT "_id", "nivel", "step"
     FROM "ACADEMICA"
     WHERE "numeroId" = $1`,
    [numeroId]
  )

  const inPeople = peopleRows.length > 0
  const inAcademica = academicaRows.length > 0

  if (!inPeople || !inAcademica) {
    return successResponse({
      found: false,
      inPeople,
      inAcademica,
      message: !inPeople && !inAcademica
        ? 'No se encontró en PEOPLE ni en ACADEMICA'
        : !inPeople
        ? 'No se encontró en PEOPLE'
        : 'No se encontró en ACADEMICA',
    })
  }

  // Prefer BENEFICIARIO row for display name
  const personRow =
    peopleRows.find(r => r.tipoUsuario === 'BENEFICIARIO' || r.tipoUsuario === 'BENEFICIARIA') ??
    peopleRows[0]

  const nombreCompleto = [personRow.primerNombre, personRow.primerApellido]
    .filter(Boolean)
    .join(' ')

  // Collect all ACADEMICA _ids for this numeroId
  const academicaIds = academicaRows.map(r => r._id)

  // Count ACADEMICA_BOOKINGS (excluding WELCOME)
  const bookingsCountRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "ACADEMICA_BOOKINGS" ab
     WHERE COALESCE(ab."studentId", ab."idEstudiante") = ANY($1::text[])
       AND ab."nivel" IS DISTINCT FROM 'WELCOME'
       AND (ab."step" IS NULL OR ab."step" NOT ILIKE '%WELCOME%')
       AND COALESCE(ab."tipoEvento", ab."tipo") IS DISTINCT FROM 'WELCOME'
       AND (ab."tituloONivel" IS NULL OR ab."tituloONivel" NOT ILIKE '%WELCOME%')
       AND (ab."nombreEvento" IS NULL OR ab."nombreEvento" NOT ILIKE '%WELCOME%')`,
    [academicaIds]
  )

  // Count COMPLEMENTARIA_ATTEMPTS
  const complementariaCountRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "COMPLEMENTARIA_ATTEMPTS"
     WHERE "studentId" = ANY($1::text[])`,
    [academicaIds]
  )

  // Count STEP_OVERRIDES (studentId = ACADEMICA _id per CLAUDE.md)
  const stepOverridesCountRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "STEP_OVERRIDES"
     WHERE "studentId" = ANY($1::text[])`,
    [academicaIds]
  )

  return successResponse({
    found: true,
    inPeople: true,
    inAcademica: true,
    nombreCompleto,
    numeroId,
    academicaIds,
    counts: {
      bookings: parseInt(bookingsCountRow?.count ?? '0', 10),
      complementaria: parseInt(complementariaCountRow?.count ?? '0', 10),
      stepOverrides: parseInt(stepOverridesCountRow?.count ?? '0', 10),
    },
  })
})
