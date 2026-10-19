import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { exigirClaveKids } from '@/lib/kids-sync-server';
import { aplicarMatriculaDesdeKids } from '@/lib/kids-matricula-sync';

/**
 * POST /api/kids-sync/matricula — camino de VUELTA desde KIDS2026.
 *
 * Traslado hecho en KIDS (cambio de salón o cambio de curso JUNIOR ↔ YOUNGSTER)
 * sobre un niño que viene de LGS: se refleja en KIDS_INSCRIPCIONES (curso, salón,
 * horario, campaña). KIDS es la fuente de verdad de la ubicación; LGS es espejo.
 *
 * Body: { externalRef, tipoCurso, classroomId | null, enrollmentId?, motivo? }
 */
export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const externalRef = String(body?.externalRef || '').trim();
  if (!externalRef.includes('#')) throw new ValidationError('externalRef es obligatorio (contrato#documento)');
  const r = await aplicarMatriculaDesdeKids({
    externalRef,
    tipoCurso: String(body?.tipoCurso || ''),
    classroomId: body?.classroomId ? String(body.classroomId) : null,
    enrollmentId: body?.enrollmentId ? String(body.enrollmentId) : null,
  });
  if (r.aplicado) {
    console.log(`[kids-sync/matricula] ${externalRef}: ${r.antes.tipoCurso}/${r.antes.salonNombre} → ${r.despues.tipoCurso}/${r.despues.salonNombre}` +
      (body?.motivo ? ` (${String(body.motivo).slice(0, 200)})` : ''));
  }
  return successResponse(r);
});
