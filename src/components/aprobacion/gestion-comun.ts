/**
 * Libro de Producción › Gestión: tipos, columnas y conteos compartidos por
 * GestionComercialPanel y ConsultarGestion (client-safe).
 */

export type Grupo = 'aprobada' | 'rechazada' | 'devuelta' | 'retractada' | 'firmadaSinAprobar' | 'pendiente'
export type CargoKey = 'ejTraining' | 'fullExecutive' | 'jefeGrupo' | 'gerente' | 'gerenteDivision' | 'salesManager'
export interface Fila {
  anio: number; mes: number; semana: number | null; pais: string; filial: string; grupo: Grupo; estado: string
  escala: Record<CargoKey, string>
  contrato: string; titularId: string
  /** Solo llega con permiso APROBACION.LIBRO_PRODUCCION.VER. */
  titular?: string
}
export const CARGOS: [CargoKey, string][] = [
  ['ejTraining', 'Ej. Training'], ['fullExecutive', 'Full Executive'], ['jefeGrupo', 'Jefe de grupo'],
  ['gerente', 'Gerente'], ['gerenteDivision', 'Gerente división'], ['salesManager', 'Sales Manager'],
]
// Orden acordado 2026-11-27: Aprobadas, Firmadas sin aprobar, Rechazadas, Devueltas, Retractadas, Pendientes, Generadas.
// El 4.º elemento es la ayuda del encabezado (estados de lib/estado-aprobacion).
export const COLS: [Grupo | 'total', string, string, string][] = [
  ['aprobada', 'Aprobadas', 'text-green-700', 'Aprobado o Finalizado'],
  ['firmadaSinAprobar', 'Firmadas sin aprobar', 'text-amber-700', 'Sin estado y firmado (código OTP o «Sí acepto»): Listo para aprobación o Requisitos incompletos'],
  ['rechazada', 'Rechazadas', 'text-red-700', 'Rechazado'],
  ['devuelta', 'Devueltas', 'text-orange-700', 'Pendiente Comercial (devuelto a Comercial para corregir) y Devuelto antiguo'],
  ['retractada', 'Retractadas', 'text-rose-700', 'Retractado (usó la cláusula de retracto)'],
  ['pendiente', 'Pendientes', 'text-slate-600', 'Sin firmar, Contrato nulo u otro estado'],
  ['total', 'Generadas', 'text-gray-900', 'Todos los contratos creados en el período (suma de las columnas anteriores)'],
]
export type Conteo = Record<Grupo | 'total', number>
export const vacio = (): Conteo => ({ total: 0, aprobada: 0, rechazada: 0, devuelta: 0, retractada: 0, firmadaSinAprobar: 0, pendiente: 0 })
export const contar = (filas: Fila[]) => filas.reduce((c, f) => { c.total++; c[f.grupo]++; return c }, vacio())
export const pct = (c: Conteo) => (c.total ? `${Math.round((c.aprobada / c.total) * 100)}%` : '—')
/** Clave para agrupar un nombre escrito de varias formas (mayúsculas, tildes, espacios). */
export const clave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const ESTADO_CLS: Record<Grupo, string> = {
  aprobada: 'bg-green-50 text-green-700', rechazada: 'bg-red-50 text-red-700', devuelta: 'bg-orange-50 text-orange-700',
  retractada: 'bg-rose-50 text-rose-700', firmadaSinAprobar: 'bg-amber-50 text-amber-700', pendiente: 'bg-slate-100 text-slate-600',
}
