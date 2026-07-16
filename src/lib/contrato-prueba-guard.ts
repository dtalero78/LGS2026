import 'server-only';
import { ForbiddenError } from '@/lib/errors';

/**
 * Guard: los contratos de prueba (prefijo PRB-) solo puede aprobarlos SUPER_ADMIN.
 *
 * El prefijo PRB- ya excluye estos contratos de los informes y del Centro de
 * Aprobaciones (`approvals/pending` los filtra), pero NADA impedía aprobarlos
 * desde el botón "Aprobar" de /person/[id]. Aprobar dispara efectos REALES:
 * envía un WhatsApp con el link de registro al celular del registro, sella
 * `fechaIngreso` y habilita el flujo completo del estudiante.
 *
 * Se permite a SUPER_ADMIN para poder probar el flujo de aprobación end-to-end.
 *
 * @param contrato  número de contrato de la persona
 * @param role      rol del usuario de la sesión (NUNCA del body)
 */
export function assertPuedeAprobarContrato(contrato: string | null | undefined, role: string | null | undefined): void {
  const esPrueba = /^PRB-/i.test((contrato ?? '').trim());
  if (!esPrueba) return;
  if ((role ?? '').toString().toUpperCase() === 'SUPER_ADMIN') return;
  throw new ForbiddenError(
    `El contrato ${contrato} es de prueba (PRB-) y no puede aprobarse. Solo un Superusuario puede hacerlo.`,
  );
}
