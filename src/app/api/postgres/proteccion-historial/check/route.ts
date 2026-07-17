import 'server-only';
import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryOne } from '@/lib/postgres';

/**
 * GET /api/postgres/proteccion-historial/check?numeroId=X[&contratoNuevo=Y]
 *
 * ¿Este documento ya tiene ficha académica de un contrato ANTERIOR? Se usa para
 * decidir si mostrar el modal de "protección de historial" al agregar un
 * beneficiario. Devuelve el contrato viejo y cuántos agendamientos tiene.
 *
 * `existeHistorial=true` solo si hay ACADEMICA cuyo contrato (por PEOPLE) es
 * DISTINTO al contrato nuevo — así no se dispara sobre la misma matrícula.
 */
export const GET = handlerWithAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const numeroId = (searchParams.get('numeroId') || '').trim();
  const contratoNuevo = (searchParams.get('contratoNuevo') || '').trim() || null;
  if (!numeroId) return successResponse({ existeHistorial: false });

  const row = await queryOne<{ academicaId: string; contratoViejo: string | null; bookings: number }>(
    `SELECT a."_id" AS "academicaId",
            (SELECT p."contrato" FROM "PEOPLE" p
              WHERE p."numeroId" = a."numeroId"
              ORDER BY CASE WHEN p."tipoUsuario"='BENEFICIARIO' THEN 0 ELSE 1 END LIMIT 1) AS "contratoViejo",
            (SELECT COUNT(*)::int FROM "ACADEMICA_BOOKINGS" b
              WHERE COALESCE(b."studentId", b."idEstudiante") = a."_id") AS bookings
       FROM "ACADEMICA" a
      WHERE a."numeroId" = $1 LIMIT 1`,
    [numeroId],
  );

  if (!row) return successResponse({ existeHistorial: false });

  // Si el contrato de la ACADEMICA es el mismo que el nuevo → es la misma
  // matrícula, no hay nada que proteger.
  const distinto = !contratoNuevo || !row.contratoViejo || row.contratoViejo !== contratoNuevo;

  return successResponse({
    existeHistorial: distinto,
    academicaId: row.academicaId,
    contratoViejo: row.contratoViejo,
    bookings: row.bookings,
  });
});
