import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { PeopleRepository } from '@/repositories/people.repository';
import { attachKidsInscripciones } from '@/lib/kids-inscripciones';
import { kidsIntake, KidsIntakeError } from '@/lib/kids-intake';

/**
 * GET /api/postgres/people/[id]/kids-estado
 *
 * Estado del beneficiario Kids en KIDS2026 (fuente de verdad: KIDS, no LGS).
 * Consulta GET {KIDS}/api/kids-intake/reservations/{kidsExternalRef} y devuelve
 * `situacion` (CURSANDO | SUSPENDIDO | NO_CURSANDO), `activo` y `detalle`.
 *
 * Es un endpoint aparte (y no parte de GET people/[id]) para que la latencia o
 * una caída de KIDS nunca frene la carga de la ficha.
 *
 * Respuesta: { estado: 'OK' | 'SIN_REGISTRO' | 'NO_KIDS' | 'NO_CONFIGURADO' | 'ERROR', ... }
 */
export const GET = handlerWithAuth(async (_request, { params }) => {
  const person: any = await PeopleRepository.findByIdOrNumeroIdOrThrow(params.id);

  if (person.kids !== true) {
    return successResponse({ estado: 'NO_KIDS' });
  }
  if (!kidsIntake.isConfigured()) {
    return successResponse({ estado: 'NO_CONFIGURADO', mensaje: 'Integración KIDS no configurada' });
  }

  // N° de contrato en KIDS = el guardado al reservar (KIDS_INSCRIPCIONES.kidsExternalRef),
  // con el documento del niño al final ("02-10764-26#121290"). Si no quedó guardado,
  // se reconstruye con el mismo formato.
  const [conInsc] = await attachKidsInscripciones(person.contrato, [person]);
  const ins = (conInsc as any)?.kidsInscripcion || null;
  const externalRef: string | null =
    ins?.kidsExternalRef ||
    (person.contrato && person.numeroId ? `${person.contrato}#${String(person.numeroId).trim()}` : null);

  if (!externalRef) {
    return successResponse({ estado: 'SIN_REGISTRO', mensaje: 'Sin N° de contrato KIDS' });
  }

  try {
    const r = await kidsIntake.getReservation(externalRef);
    return successResponse({
      estado: 'OK',
      externalRef,
      situacion: r.situacion ?? null,
      activo: r.activo === true,
      detalle: r.detalle ?? null,
      motivo: r.motivo ?? null,
      estadoKids: r.estado ?? null,
      programa: r.programa ?? null,
      contrato: r.contrato ?? null,
      username: r.nino?.username ?? null,
    });
  } catch (e) {
    const status = e instanceof KidsIntakeError ? e.status : undefined;
    if (status === 404) {
      return successResponse({ estado: 'SIN_REGISTRO', externalRef, mensaje: 'Sin registro en KIDS' });
    }
    console.error('❌ [kids-estado]', externalRef, status, (e as Error)?.message);
    return successResponse({
      estado: 'ERROR',
      externalRef,
      mensaje: status === 401 ? 'KIDS rechazó la llave de servicio (401)' : 'No se pudo consultar KIDS',
    });
  }
});
