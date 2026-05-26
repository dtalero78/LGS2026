/**
 * Helpers para derivar el estado visual del contrato a partir de los
 * campos canónicos de PEOPLE. No tocan BD — sólo cálculos.
 *
 * El badge amarillo "SUSPENDIDA" solo debe aparecer cuando la suspensión
 * fue producto del toggle administrativo en /person/[id] → Administración
 * ("Estado del Contrato") o del botón "Inactivar" individual en esa misma
 * pantalla. No debe aparecer cuando estadoInactivo=true viene por otras
 * causas:
 *
 *   - Cron expire-contracts                  → estado='FINALIZADA'
 *   - Expiración al login (panel-estudiante)  → estado='FINALIZADA'
 *   - OnHold activo                          → fechaOnHold IS NOT NULL
 *   - Cambio estado a Contrato nulo/Devuelto/Rechazado → estado='ANULADO'
 *   - Special-nivel block (MASTER/IELTS/B2F/TOEFL)     → estado='FINALIZADA'
 *   - Bulk bloqueo Mantenimiento             → estado='FINALIZADA'
 *
 * Política unificada (mayo 2026): todos los flujos de vencimiento sólo
 * escriben `estado='FINALIZADA'`. El campo `aprobacion` NUNCA se
 * sobrescribe por vencimiento — refleja la decisión comercial original.
 *
 * En lugar de mantener una blacklist por campo (frágil y propensa a
 * falsos positivos), usamos una regla positiva: el badge se muestra
 * sii la columna `suspenddata` registra una INACTIVACION explícita.
 * Solo los dos flujos administrativos mencionados escriben ese campo.
 */

export interface SuspendData {
  accion: 'INACTIVACION' | 'REACTIVACION'
  motivo: string
  fecha: string
  realizadoPor: string
  realizadoPorNombre?: string
}

interface ContractStatusInput {
  estadoInactivo?: boolean | null
  suspenddata?: SuspendData | null
}

/**
 * `true` si la persona está suspendida administrativamente (toggle
 * Inactivo desde /person/[id] → Administración). Robusta contra futuros
 * flujos que pongan estadoInactivo=true por otras causas: si el último
 * registro en suspenddata no es una INACTIVACION, NO es suspensión admin.
 */
export function isAdminSuspended(person: ContractStatusInput | null | undefined): boolean {
  if (!person) return false
  if (person.estadoInactivo !== true) return false
  return person.suspenddata?.accion === 'INACTIVACION'
}
