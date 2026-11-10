/**
 * "El pago tiene varios recibos" — regla única (client-safe) de cuántos
 * comprobantes respaldan UN mismo pago. Con un solo recibo se usa el flujo
 * normal ("Leer recibo"); con varios, de MIN_RECIBOS a MAX_RECIBOS.
 *
 * El nombre del campo en BD/API sigue siendo `dosRecibos` (histórico): hoy
 * significa "el pago tiene varios recibos" (2 a 5).
 */
export const MIN_RECIBOS = 2
export const MAX_RECIBOS = 5

/** Mensaje de error si la cantidad no es válida, o null si está bien. */
export function errorCantidadRecibos(n: number): string | null {
  if (n < MIN_RECIBOS) return `Con varios recibos adjunta al menos ${MIN_RECIBOS}.`
  if (n > MAX_RECIBOS) return `Máximo ${MAX_RECIBOS} recibos por pago.`
  return null
}

/** Etiqueta corta para listados / seguimiento: "3 recibos". */
export function etiquetaRecibos(n: number | null | undefined): string {
  return `${n && n > 0 ? n : 2} recibos`
}
