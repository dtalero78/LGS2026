import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import {
  aplicarConfirmacion,
  type ExamPrueba,
} from '@/services/exam-intern.service';

/**
 * POST /api/postgres/servicio/exam-intern/aplicar-confirmacion
 *
 * Body:
 *   {
 *     prueba:        'IELTS' | 'B2FIRST' | 'TOEFL',
 *     fechaBase:     'YYYY-MM-DD',
 *     confirmados:   string[],   // ACADEMICA._id list (extends + WhatsApp)
 *     noConfirmados: string[]    // ACADEMICA._id list (promote to DONE Step 50)
 *   }
 *
 * For each confirmed student: finalContrato = fechaBase + 100 days, restore
 * login, keep them in their special Step (47/48/49), send WhatsApp.
 * For each NOT confirmed student: promote to DONE Step 50 + block login.
 *
 * Every processed student is logged in the EXAM_INTERN_AUDIT table.
 */
export const POST = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  const body = await request.json();

  const prueba: ExamPrueba = (body?.prueba || '').toUpperCase();
  const fechaBase: string = body?.fechaBase || '';
  const confirmados: string[]   = Array.isArray(body?.confirmados)   ? body.confirmados   : [];
  const noConfirmados: string[] = Array.isArray(body?.noConfirmados) ? body.noConfirmados : [];

  if (!['IELTS', 'B2FIRST', 'TOEFL'].includes(prueba)) {
    throw new ValidationError(`prueba inválida: ${prueba}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaBase)) {
    throw new ValidationError(`fechaBase inválida (esperado YYYY-MM-DD): ${fechaBase}`);
  }

  const ejecutadoPor = (session?.user?.email as string) || 'desconocido';

  const result = await aplicarConfirmacion({
    prueba,
    fechaBase,
    confirmados,
    noConfirmados,
    ejecutadoPor,
  });

  return successResponse({
    message: `Proceso aplicado: ${result.extendidos} extendido(s), ${result.bloqueados} bloqueado(s).`,
    ...result,
  });
});
