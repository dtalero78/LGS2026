/**
 * Tipos (espejo de liquidacion-advisors.service) y formatos de moneda para las
 * pestañas Detalle Advisors y Consolidado de Gestión Advisors. Client-safe.
 */

export type Pais = 'Chile' | 'Colombia' | 'Ecuador'
export const PAISES: Pais[] = ['Chile', 'Colombia', 'Ecuador']
export type TipoClase = 'sesiones' | 'jumps' | 'training' | 'clubes' | 'welcome' | 'essential' | 'examen' | 'otros' | 'administrativas' | 'kids' | 'ajustes'
export type Corte = 'MES' | 'Q1' | 'Q2'
export type EstadoCorte = 'ABIERTO' | 'FACTURA_RECIBIDA' | 'DEVUELTA' | 'SIN_FACTURA' | 'SIN_HORAS' | 'VERIFICADO' | 'PAGADO'

export const ESTADO_CORTE: Record<EstadoCorte, { l: string; cls: string }> = {
  ABIERTO: { l: 'Abierto', cls: 'bg-gray-100 text-gray-700' },
  FACTURA_RECIBIDA: { l: 'Factura recibida', cls: 'bg-sky-100 text-sky-800' },
  DEVUELTA: { l: 'Devuelta', cls: 'bg-amber-100 text-amber-800' },
  SIN_FACTURA: { l: 'Sin factura', cls: 'bg-red-100 text-red-700' },
  SIN_HORAS: { l: 'Sin horas', cls: 'bg-gray-50 text-gray-400' },
  VERIFICADO: { l: 'Verificado', cls: 'bg-emerald-100 text-emerald-800' },
  PAGADO: { l: 'Pagado', cls: 'bg-emerald-700 text-white' },
}
export const CORTE_LABEL: Record<Corte, string> = { MES: 'Mes', Q1: '1ra Q', Q2: '2da Q' }
export interface FacturaCorte {
  _id: string; nombre: string | null; tipo: string | null; estado: string; subidoEn: string; subidoPor: string | null; concepto: string | null
  extraido: any; comentarioDevolucion: string | null; devueltaPor: string | null; devueltaEn: string | null; inconsistencias: string[]
}
/** Qué cobra cada factura cuando un corte se cobra en varias (p. ej. horas normales + Exam. Intern.). */
export const CONCEPTOS_FACTURA = [
  { v: 'NORMAL', l: 'Horas normales' }, { v: 'EXAM_INTERN', l: 'Exam. Internacional' },
  { v: 'FESTIVO', l: 'Festivos' }, { v: 'OTRO', l: 'Otro' },
]
export const MAX_FACTURAS_CORTE = 3

export const CONCEPTOS_AJUSTE = [
  { v: 'NORMAL', l: 'Horas normales' }, { v: 'FESTIVO', l: 'Festivo' }, { v: 'EXAM_INTERN', l: 'Exam. intern.' },
  { v: 'SIN_ASISTENTES', l: 'Sin asistentes (½ h)' }, { v: 'EXTRA_AUTORIZADA', l: 'Extra autorizada (semiplanta)' },
  { v: 'GESTION_ADMIN', l: 'Gestión administrativa (informativo)' },
]

export interface CorteInfo {
  liqId: string | null; advisorId: string; programa: 'LGS' | 'KIDS'; corte: Corte
  estado: EstadoCorte; requiereFactura: boolean; plazo: string; plazoReenvio: string | null
  horas: number; valor: number | null; moneda: string
  horasOk: boolean; horasOkPor: string | null
  verificadoPor: string | null; verificadoEn: string | null; pagadoPor: string | null; pagadoEn: string | null; referenciaPago: string | null
  snapshot: any; cambioTrasVerificar: boolean
  /** Factura más reciente del conjunto; sus inconsistencias son las del conjunto (sumas). */
  factura: null | FacturaCorte
  /** Todas las facturas vigentes del corte (se revisan sumadas). */
  facturas: FacturaCorte[]
  ajustes: { _id: string; alcance: string; semanaInicio: string | null; concepto: string; horas: number; motivo: string; usuarioEmail: string | null; usuarioNombre: string | null; fecha: string }[]
}
export const claveCorte = (advisorId: string, programa: string, corte: string) => `${advisorId}|${programa}|${corte}`
export type Concepto = 'NORMAL' | 'FESTIVO' | 'EXAM_INTERN'
type PorTipo = Record<TipoClase, number>
type PorPais = Record<Pais, number>

export const COLUMNAS_TIPO: { k: TipoClase; l: string }[] = [
  { k: 'sesiones', l: 'Sesiones' }, { k: 'jumps', l: 'Jumps' }, { k: 'training', l: 'Training' },
  { k: 'clubes', l: 'Clubes' }, { k: 'welcome', l: 'Welcome' }, { k: 'essential', l: 'ESS' },
  { k: 'examen', l: 'Exam.' }, { k: 'administrativas', l: 'Admin.' }, { k: 'otros', l: 'Otros' },
  { k: 'kids', l: 'Sesiones Kids' }, { k: 'ajustes', l: 'Ajustes' },
]

export interface EventoLiq {
  eventoId: string; fecha: string; hora: string | null; semana: number; quincena: 1 | 2
  tipo: TipoClase; concepto: Concepto; horas: number; titulo: string
  inscritos: number; asistentes: number; sinAsistentes: boolean; compartido: boolean; cerrada: boolean
  festivo: string | null; reparto: PorPais
}

export interface AdvisorLiq {
  programaLiq: 'LGS' | 'KIDS'
  advisorId: string; nombre: string; email: string | null; activo: boolean
  pais: Pais; tipoContratacion: string; categoriaTarifa: string; programa: string
  porTipo: PorTipo; porConcepto: Record<Concepto, number>; sinAsistentes: number
  semanas: { n: number; total: number; porTipo: PorTipo }[]
  quincenas: { q1: number; q2: number }
  total: number; reparto: PorPais
  noPagadas: { canceladas: number; suspendidas: number; noAsistio: number }
  porConceptoQ: { q1: Record<Concepto, number>; q2: Record<Concepto, number> }
  extras: { q1: number; q2: number }; gestionAdmin: number; ajustes: number
  cortes: { corte: Corte; horas: number; valor: number | null }[]
  valor: null | {
    moneda: string; normal: number; festivo: number; exam: number; extras: number; fijo: number; total: number
    reparto: PorPais; tarifas: Partial<Record<Concepto, number>>; faltanTarifas: Concepto[]
  }
  eventos?: EventoLiq[]
}

export interface Liquidacion {
  periodo: string; parcial: boolean; verValores: boolean
  semanas: { n: number; inicio: string; fin: string }[]
  advisors: AdvisorLiq[]
  tipoCambio: { COP: number | null; CLP: number | null; fecha: string | null; fuente: string | null }
  kids: { ok: boolean; error: string | null; sinGuia: number; guiaSinEnlace: { username: string; sesiones: number }[] }
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
