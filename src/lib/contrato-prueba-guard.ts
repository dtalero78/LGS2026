import 'server-only';
import { ForbiddenError } from '@/lib/errors';

/**
 * Un contrato de prueba lleva el prefijo `PRB-` en su número.
 */
export function esContratoPrueba(contrato: string | null | undefined): boolean {
  return /^PRB-/i.test((contrato ?? '').trim());
}

/**
 * Guard: los contratos de prueba (prefijo PRB-) no pueden disparar los efectos
 * que crean datos reales. Bloqueado para **TODOS los roles, sin excepción**
 * (tampoco SUPER_ADMIN):
 *   - aprobar el contrato               (people/approve, approvals/[id], people PATCH)
 *   - crear beneficiarios / fichas en ACADEMICA (approve bloqueado → no se crea ACADEMICA)
 *   - agregar titular/beneficiario      (people POST, proteccion-historial)
 *
 * DESDE 2026-09-08 un PRB- **SÍ puede firmarse de punta a punta** (solicitar
 * firma, OTP, autoaprobar consentimiento y "Enviar PDF"), para poder ensayar el
 * proceso completo incluida la página de bienvenida. Las contenciones son otras:
 *   - el PDF sale con marca de agua "CONTRATO DE PRUEBA / SIN VALIDEZ LEGAL"
 *     (opción `esPrueba` de contract-pdf-html, punto único de los 4 generadores)
 *   - no se archiva en Drive: ni el contrato ni el anexo ANEX-
 *   - la APROBACIÓN sigue bloqueada, así que nunca nace ACADEMICA ni el login
 *
 * ⚠️ Firmar un PRB- envía WhatsApp REAL (OTP y PDF) al celular registrado.
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
