import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { queryMany } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/servicio/exam-intern
 *
 * Lists ACADEMICA students preparing an international test. A student is
 * considered "preparing test X" when `pruebainter = X` OR `step = STEP_OF_X`.
 *
 * Required query param:
 *   prueba — 'IELTS' | 'B2FIRST' | 'TOEFL'
 *
 * Optional filters:
 *   startDate / endDate — bounds on fechaPromocionEspecial (YYYY-MM-DD, inclusive)
 *   plataforma — exact match on ACADEMICA.plataforma
 *   search — partial match on primerApellido, segundoApellido or numeroId (case-insensitive)
 */

const PRUEBA_TO_STEP: Record<string, string> = {
  IELTS:   'Step 47',
  B2FIRST: 'Step 48',
  TOEFL:   'Step 49',
};

interface ExamInternRow {
  _id: string;
  numeroId: string | null;
  primerNombre: string | null;
  segundoNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  celular: string | null;
  email: string | null;
  plataforma: string | null;
  pruebainter: string | null;
  nivel: string | null;
  step: string | null;
  fechaPromocionEspecial: string | null;
}

export const GET = handlerWithAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const prueba = (searchParams.get('prueba') || '').toUpperCase();

  if (!PRUEBA_TO_STEP[prueba]) {
    throw new ValidationError(
      `Parámetro "prueba" inválido. Valores aceptados: ${Object.keys(PRUEBA_TO_STEP).join(', ')}`
    );
  }

  const startDate  = searchParams.get('startDate') || null;
  const endDate    = searchParams.get('endDate')   || null;
  const plataforma = searchParams.get('plataforma') || null;
  const search     = (searchParams.get('search') || '').trim();

  const where: string[] = [
    `("pruebainter" = $1 OR "step" = $2)`,
    // Ocultar a quienes ya fueron CONFIRMADOS y AGRUPADOS: tienen al menos una
    // inscripción ACTIVA (cancelo=false) en un evento del ciclo de este examen
    // (CALENDARIO.cicloId IS NOT NULL AND nivel = prueba). Estar agrupado implica
    // haber sido confirmado antes (el pool de Agrupación son los confirmados).
    `NOT EXISTS (
       SELECT 1 FROM "ACADEMICA_BOOKINGS" b
         JOIN "CALENDARIO" c ON (b."eventoId" = c."_id" OR b."idEvento" = c."_id")
        WHERE (b."studentId" = "ACADEMICA"."_id" OR b."idEstudiante" = "ACADEMICA"."_id")
          AND b."cancelo" = false
          AND c."cicloId" IS NOT NULL
          AND c."nivel" = $1
     )`,
  ];
  const params: any[] = [prueba, PRUEBA_TO_STEP[prueba]];

  if (startDate) {
    params.push(startDate);
    where.push(`"fechaPromocionEspecial"::date >= $${params.length}::date`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`"fechaPromocionEspecial"::date <= $${params.length}::date`);
  }
  if (plataforma) {
    params.push(plataforma);
    where.push(`"plataforma" = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    where.push(
      `(LOWER("primerApellido") LIKE LOWER($${idx})
        OR LOWER("segundoApellido") LIKE LOWER($${idx})
        OR "numeroId" LIKE $${idx})`
    );
  }

  const rows = await queryMany<ExamInternRow>(
    `SELECT "_id", "numeroId", "primerNombre", "segundoNombre",
            "primerApellido", "segundoApellido",
            "celular", "email", "plataforma",
            "pruebainter", "nivel", "step", "fechaPromocionEspecial"
     FROM "ACADEMICA"
     WHERE ${where.join(' AND ')}
     ORDER BY "fechaPromocionEspecial" DESC NULLS LAST, "primerApellido" ASC`,
    params
  );

  return successResponse({ students: rows, count: rows.length });
});
