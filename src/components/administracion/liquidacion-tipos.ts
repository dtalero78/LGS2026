/**
 * Tipos (espejo de liquidacion-advisors.service) y formatos de moneda para las
 * pestañas Detalle Advisors y Consolidado de Gestión Advisors. Client-safe.
 */

export type Pais = 'Chile' | 'Colombia' | 'Ecuador'
export const PAISES: Pais[] = ['Chile', 'Colombia', 'Ecuador']
export type TipoClase = 'sesiones' | 'jumps' | 'training' | 'clubes' | 'welcome' | 'essential' | 'examen' | 'otros' | 'administrativas'
export type Concepto = 'NORMAL' | 'FESTIVO' | 'EXAM_INTERN'
type PorTipo = Record<TipoClase, number>
type PorPais = Record<Pais, number>

export const COLUMNAS_TIPO: { k: TipoClase; l: string }[] = [
  { k: 'sesiones', l: 'Sesiones' }, { k: 'jumps', l: 'Jumps' }, { k: 'training', l: 'Training' },
  { k: 'clubes', l: 'Clubes' }, { k: 'welcome', l: 'Welcome' }, { k: 'essential', l: 'ESS' },
  { k: 'examen', l: 'Exam.' }, { k: 'administrativas', l: 'Admin.' }, { k: 'otros', l: 'Otros' },
]

export interface EventoLiq {
  eventoId: string; fecha: string; hora: string | null; semana: number; quincena: 1 | 2
  tipo: TipoClase; concepto: Concepto; horas: number; titulo: string
  inscritos: number; asistentes: number; sinAsistentes: boolean; compartido: boolean; cerrada: boolean
  festivo: string | null; reparto: PorPais
}

export interface AdvisorLiq {
  advisorId: string; nombre: string; email: string | null; activo: boolean
  pais: Pais; tipoContratacion: string; categoriaTarifa: string; programa: string
  porTipo: PorTipo; porConcepto: Record<Concepto, number>; sinAsistentes: number
  semanas: { n: number; total: number; porTipo: PorTipo }[]
  quincenas: { q1: number; q2: number }
  total: number; reparto: PorPais
  noPagadas: { canceladas: number; suspendidas: number; noAsistio: number }
  valor: null | {
    moneda: string; normal: number; festivo: number; exam: number; fijo: number; total: number
    reparto: PorPais; tarifas: Partial<Record<Concepto, number>>; faltanTarifas: Concepto[]
  }
  eventos?: EventoLiq[]
}

export interface Liquidacion {
  periodo: string; parcial: boolean; verValores: boolean
  semanas: { n: number; inicio: string; fin: string }[]
  advisors: AdvisorLiq[]
  tipoCambio: { COP: number | null; CLP: number | null; fecha: string | null; fuente: string | null }
}

export const MONEDA: Record<Pais, 'CLP' | 'COP' | 'USD'> = { Chile: 'CLP', Colombia: 'COP', Ecuador: 'USD' }
export const CORTE: Record<Pais, string> = { Chile: 'mensual', Colombia: 'quincenal', Ecuador: 'mensual' }
export const TIPO_LABEL: Record<string, string> = { POR_HORAS: 'Por horas', SEMIPLANTA: 'Semiplanta', PLANTA: 'Planta' }

export const fmtH = (n: number) => (n ? n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—')

export function fmtMoneda(v: number | null | undefined, moneda: string) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const dec = moneda === 'USD' ? 2 : 0
  return `${moneda === 'USD' ? 'U$' : '$'}${v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

/** Convierte un valor en moneda local a las tres monedas. null si falta el tipo de cambio. */
export function enTresMonedas(valor: number, moneda: string, tc: Liquidacion['tipoCambio']) {
  const usd = moneda === 'USD' ? valor : moneda === 'COP' ? (tc.COP ? valor / tc.COP : null) : (tc.CLP ? valor / tc.CLP : null)
  return {
    USD: usd,
    CLP: moneda === 'CLP' ? valor : usd !== null && tc.CLP ? usd * tc.CLP : null,
    COP: moneda === 'COP' ? valor : usd !== null && tc.COP ? usd * tc.COP : null,
  }
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const etiquetaPeriodo = (p: string) => { const [y, m] = p.split('-').map(Number); return `${MESES[m - 1]} ${y}` }
export const corrPeriodo = (p: string, delta: number) => {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
