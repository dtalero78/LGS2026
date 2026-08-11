import 'server-only';
import { ForbiddenError } from '@/lib/errors';

/**
 * Un contrato de prueba lleva el prefijo `PRB-` en su número.
 */
export function esContratoPrueba(contrato: string | null | undefined): boolean {
  return /^PRB-/i.test((contrato ?? '').trim());
}

/**
 * Guard: los contratos de prueba (prefijo PRB-) SOLO se pueden ver, editar,
 * y adjuntarles documentación. Cualquier utilidad que dispare efectos reales
 * o de producción está bloqueada para **TODOS los roles, sin excepción**
 * (tampoco SUPER_ADMIN) — el contrato es de prueba y no debe:
 *   - solicitar firma / verificar OTP  (consent.service)
 *   - enviar el PDF por WhatsApp        (contracts/[id]/send-pdf)
 *   - autoaprobar consentimiento        (consent/[id]/auto-approve)
 *   - aprobar el contrato               (people/approve, approvals/[id], people PATCH)
 *   - crear beneficiarios / fichas en ACADEMICA (approve queda bloqueado → no se crea ACADEMICA)
 *   - agregar titular/beneficiario      (people POST, proteccion-historial)
 *
 * `accion` se interpola en el mensaje 403 para que la UI/usuario sepa qué se bloqueó.
 *
 * @param contrato número de contrato de la persona
 * @param accion   descripción de la acción bloqueada (p. ej. 'enviar el PDF')
 */
export function assertNoEsContratoPrueba(
  contrato: string | null | undefined,
  accion = 'esta acción',
): void {
  if (!esContratoPrueba(contrato)) return;
  throw new ForbiddenError(
    `El contrato ${contrato} es de PRUEBA (PRB-): ${accion} no está disponible para contratos de prueba. Solo se puede ver, editar y adjuntar documentación.`,
  );
}
