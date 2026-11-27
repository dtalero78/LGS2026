'use client'

/**
 * Aprobación › Libro de Producción.
 * Hoja estilo Excel de los contratos de una vigencia comercial (todos los estados,
 * sin PRB-), con beneficiarios desplegables bajo su titular, encabezado y columnas
 * Item→Cédula fijas, filtros, exportación y vista detallada por contrato.
 * Pestaña Vigencias: generador anual del mes comercial (corte 9:00 hora local).
 */

import { LISTO_APROBACION, REQUISITOS_INCOMPLETOS } from '@/lib/estado-aprobacion'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon, MagnifyingGlassIcon, FunnelIcon,
  XMarkIcon, ArrowTopRightOnSquareIcon, CalendarDaysIcon, TableCellsIcon, RectangleStackIcon,
  ArrowsPointingOutIcon, ArrowUturnLeftIcon, PencilSquareIcon, ClockIcon, PresentationChartBarIcon, NoSymbolIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AprobacionPermission, PersonPermission } from '@/types/permissions'
import SeguimientoContratoModal from '@/components/common/SeguimientoContratoModal'
import { usePermissions } from '@/hooks/usePermissions'
import { api, handleApiError } from '@/hooks/use-api'
import { exportToExcel } from '@/lib/export-excel'
import PlanesTiposPanel from '@/components/aprobacion/PlanesTiposPanel'
import LibroAccionModal from '@/components/aprobacion/LibroAccionModal'
import AjusteEscaleraModal from '@/components/aprobacion/AjusteEscaleraModal'
import GestionComercialPanel from '@/components/aprobacion/GestionComercialPanel'
import {
  MESES, etiquetaVigencia, etiquetaSemana, semanasDeVigencia, type Vigencia,
} from '@/lib/vigencias-comerciales'

// ── Tipos (espejo de RegistroLibro del servicio) ───────────────────────────────
interface Benef {
  id: string; nombre: string; documento: string; telefono: string; correo: string
  programa: 'Kids' | 'LGS'; welcome: 'SI' | 'NO' | 'NA' | '—'; aprobacion: string | null
}
interface Registro {
  titularId: string; contrato: string; item: number; semana: number | null
  creadoLocal: string | null; fechaIngreso: string | null; fechaPago: string | null
  formaPago: string; conciliado: { si: boolean; por: string | null; fecha: string | null }
  plan: number | null; tipoPlan: string | null; inscripcionPagada: number | null; valorCuota: number | null
  saldo: number | null; totalPlan: number | null; fechaPrimeraCuota: string | null
  suscripcionPago: boolean; prixus: boolean; factura: string | null
  aprobacion: string; aprobacionFicha: string | null; firmado: boolean
  faltantes?: Faltante[]
  /** "Revisar documentación" tras un reemplazo de persona (Resumen de Matrícula). */
  revisarDocumentacion?: string | null
  /** Último paso a «Rechazado» (APROBACION_AUDIT): fecha, motivo y quién. null = sin registro. */
  rechazo?: { fecha: string | null; motivo: string | null; por: string | null } | null
  /** Entró a la Papelera (hora Bogotá); null = no está en la Papelera. */
  papeleraEn?: string | null
  estado: string | null; observaciones: string | null; pais: string | null
  titular: { nombre: string; documento: string; telefono: string; correo: string; direccion: string; ciudad: string }
  referencias: { nombre: string; telefono: string; parentesco: string }[]
  comercial: Record<'ejecutivo' | 'fullExecutive' | 'jefeGrupo' | 'gerente' | 'gerenteDivision' | 'salesManager' | 'filial' | 'origenMatricula', string>
  beneficiarios: Benef[]
}

// Motivo (pestaña Por resolver): lo que le falta al contrato.
type Faltante = 'FIRMA' | 'DOCUMENTOS' | 'RECIBO' | 'DRIVE'
const MOTIVOS: Record<Faltante, { label: string; ayuda: string; cls: string }> = {
  FIRMA: { label: 'Sin firmar', ayuda: 'No tiene consentimiento OTP de firma', cls: 'bg-red-100 text-red-800' },
  DOCUMENTOS: { label: 'Sin documento', ayuda: 'Sin anexo de documentos', cls: 'bg-amber-100 text-amber-800' },
  RECIBO: { label: 'Sin recibo', ayuda: 'Sin recibo de inscripción', cls: 'bg-orange-100 text-orange-800' },
  DRIVE: { label: 'Sin PDF en Drive', ayuda: 'Sin contrato generado en el Drive', cls: 'bg-slate-200 text-slate-700' },
}
/** Aprobado (o ya FINALIZADA tras estar aprobado). */
const esAprobado = (a: string) => /^(aprobad|finaliz)/i.test(String(a || '').trim())
/** Sin estado en la ficha: el sistema lo calcula (lib/estado-aprobacion). */
const esPendiente = (a: string) => a === ESTADO_LISTO || a === REQ_INCOMPLETOS
/** Rechazado: pestaña propia (con fecha, motivo y quién), nunca va a la Papelera. */
const esRechazado = (a: string) => String(a || '').trim().toLowerCase() === 'rechazado'
/**
 * Pestaña Libro: Aprobados (y Finalizados), «Listo para aprobación» (firmado o «Sí acepto»,
 * documentos, recibo y PDF en Drive), Pendiente Comercial y Retractados.
 * Rechazados → su pestaña. Todo lo demás (requisitos incompletos, Contrato nulo, Devuelto) → Por resolver.
 */
const vaAlLibro = (r: { aprobacion: string }) => {
  const a = String(r.aprobacion || '').trim().toLowerCase()
  return esAprobado(r.aprobacion) || r.aprobacion === ESTADO_LISTO || a === 'pendiente comercial' || a === 'retractado'
}
type Vista = 'libro' | 'resolver' | 'rechazados' | 'papelera'
const vistaDe = (r: { aprobacion: string; papeleraEn?: string | null }): Vista =>
  r.papeleraEn ? 'papelera' : esRechazado(r.aprobacion) ? 'rechazados' : vaAlLibro(r) ? 'libro' : 'resolver'
/** Papelera: el cron la llena a los 15 días en Por resolver y borra a los 30 días dentro (services/libro-papelera). */
const BORRADO_DIAS = 30
const fechaBorrado = (papeleraEn?: string | null) => {
  if (!papeleraEn) return null
  const d = new Date(papeleraEn.slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + BORRADO_DIAS)
  return d.toISOString().slice(0, 10)
}
const diasPara = (ymd: string | null) => ymd ? Math.ceil((new Date(ymd + 'T12:00:00Z').getTime() - Date.now()) / 86400000) : null
/** Aviso tras reemplazar a una persona desde el Resumen de Matrícula (se apaga al subir un documento). */
const REVISAR_DOC = { label: 'Revisar documentación', cls: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300' }
type ConMotivo = { aprobacion: string; faltantes?: Faltante[]; revisarDocumentacion?: string | null }
/** Motivo de un contrato en Por resolver: un estado de anulación (nulo, devuelto…) o lo que le falta. */
const motivosDe = (r: ConMotivo): { label: string; ayuda: string; cls: string }[] => [
  ...(!esAprobado(r.aprobacion) && !esPendiente(r.aprobacion)
    ? [{ label: r.aprobacion, ayuda: `Estado del contrato: ${r.aprobacion}`, cls: 'bg-red-100 text-red-800' }]
    : (r.faltantes || []).map(k => MOTIVOS[k])),
  ...(r.revisarDocumentacion ? [{ ...REVISAR_DOC, ayuda: r.revisarDocumentacion }] : []),
]
const textoMotivo = (r: ConMotivo) => motivosDe(r).map(m => m.label).join(', ')

const TODOS = '__todos__'
const ESTADO_LISTO = LISTO_APROBACION // sin estado y con todos los requisitos
const REQ_INCOMPLETOS = REQUISITOS_INCOMPLETOS // sin estado y le falta algún requisito
const fmtF = (v?: string | null) => { const [y, m, d] = String(v || '').slice(0, 10).split('-'); return y && m && d ? `${d}/${m}/${y}` : '—' }
const fmtFH = (v?: string | null) => v ? `${fmtF(v)} ${v.slice(11, 16)}` : '—'
const fmtM = (n: number | null) => n === null ? '—' : `$${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`
/** Color del estado: Aprobado verde · Listo para aprobación celeste · Requisitos incompletos naranja · Pendiente Comercial ámbar · anulados/retractados rojo. */
const estadoCls = (a: string | null) => {
  const s = String(a || '').toLowerCase()
  if (s.startsWith('aprobad')) return 'bg-green-100 text-green-800'
  if (s === ESTADO_LISTO.toLowerCase()) return 'bg-sky-100 text-sky-800'
  if (s === REQ_INCOMPLETOS.toLowerCase()) return 'bg-orange-100 text-orange-800'
  if (s.startsWith('pendiente')) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}
const resumenSsbb = (r: Registro) => {
  const lgs = r.beneficiarios.filter(b => b.programa === 'LGS')
  if (!lgs.length) return r.beneficiarios.length ? 'NA' : '—'
  return `${lgs.filter(b => b.welcome === 'SI').length}/${lgs.length}`
}
/** Sesión de bienvenida del contrato: true = todos los beneficiarios LGS asistieron; false = falta alguno; null = no aplica (solo Kids o sin beneficiarios). */
const ssbbCompleto = (r: Registro): boolean | null => {
  const lgs = r.beneficiarios.filter(b => b.programa === 'LGS')
  return lgs.length ? lgs.every(b => b.welcome === 'SI') : null
}
/** Verde = asistió · Rojo = no ha asistido (o falta alguno) · Gris = no aplica. */
function SsbbPill({ texto, ok }: { texto: string; ok: boolean | null }) {
  const cls = ok === true ? 'bg-green-100 text-green-800' : ok === false ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{texto}</span>
}
const resumenPrograma = (r: Registro) => {
  const k = r.beneficiarios.filter(b => b.programa === 'Kids').length
  const l = r.beneficiarios.length - k
  return [l ? `LGS ×${l}` : '', k ? `Kids ×${k}` : ''].filter(Boolean).join(' · ') || '—'
}

// ── Columnas de la hoja (mismo orden del libro). Las 8 primeras quedan fijas. ──
interface Col { key: string; header: string; w: number; titular: (r: Registro) => React.ReactNode; benef?: (b: Benef) => React.ReactNode }
const COLS: Col[] = [
  { key: 'item', header: 'Item', w: 76, titular: r => r.item },
  { key: 'semana', header: 'Semana', w: 64, titular: r => r.semana ? etiquetaSemana(r.semana) : '—' },
  { key: 'ingreso', header: 'Fecha ingreso', w: 104, titular: r => fmtF(r.fechaIngreso) },
  { key: 'pago', header: 'Fecha de pago', w: 104, titular: r => fmtF(r.fechaPago) },
  { key: 'contrato', header: 'N° Contrato', w: 112, titular: r => r.revisarDocumentacion
      ? <span className="inline-flex items-center gap-1" title={`Revisar documentación: ${r.revisarDocumentacion}`}>{r.contrato}<span className={`px-1 rounded text-[10px] font-bold ${REVISAR_DOC.cls}`}>⚠ Doc</span></span>
      : r.contrato },
  { key: 'titular', header: 'Titular', w: 230, titular: r => r.titular.nombre, benef: b => b.nombre },
  { key: 'cedula', header: 'Cédula titular', w: 116, titular: r => r.titular.documento, benef: b => b.documento },
  { key: 'tel', header: 'Teléfono titular', w: 124, titular: r => r.titular.telefono, benef: b => b.telefono },
  { key: 'correo', header: 'Correo titular', w: 220, titular: r => r.titular.correo, benef: b => b.correo },
  { key: 'pais', header: 'País', w: 90, titular: r => r.pais || '—' },
  { key: 'dir', header: 'Dirección', w: 220, titular: r => r.titular.direccion },
  { key: 'ciudad', header: 'Ciudad', w: 130, titular: r => r.titular.ciudad },
  { key: 'plan', header: 'Plan', w: 56, titular: r => r.plan ?? '—' },
  { key: 'tipoPlan', header: 'Tipo plan', w: 120, titular: r => r.tipoPlan || '—' },
  { key: 'forma', header: 'Forma de pago', w: 170, titular: r => r.formaPago || '—' },
  { key: 'conc', header: 'Conciliado', w: 90, titular: r => r.conciliado.si ? 'SI' : 'NO' },
  { key: 'insc', header: 'Inscripción pagada', w: 120, titular: r => fmtM(r.inscripcionPagada) },
  { key: 'cuota', header: 'Valor cuota', w: 104, titular: r => fmtM(r.valorCuota) },
  { key: 'saldo', header: 'Saldo', w: 110, titular: r => fmtM(r.saldo) },
  { key: 'total', header: 'Total plan', w: 116, titular: r => fmtM(r.totalPlan) },
  { key: 'c1', header: 'Fecha 1ª cuota', w: 104, titular: r => fmtF(r.fechaPrimeraCuota) },
  { key: 'susc', header: 'Suscripción de pago', w: 110, titular: r => r.suscripcionPago ? 'SI' : 'NO' },
  { key: 'fact', header: 'Factura/Bol', w: 110, titular: r => r.factura || '—' },
  { key: 'aprob', header: 'Aprobación', w: 120, titular: r => <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${estadoCls(r.aprobacion)}`}>{r.aprobacion}</span>, benef: b => b.aprobacion || 'Pendiente' },
  { key: 'obs', header: 'Observaciones', w: 260, titular: r => <span className="line-clamp-2" title={r.observaciones || ''}>{r.observaciones || ''}</span> },
  { key: 'prog', header: 'Programa', w: 110, titular: r => resumenPrograma(r), benef: b => <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.programa === 'Kids' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-indigo-100 text-indigo-800'}`}>{b.programa}</span> },
  { key: 'ssbb', header: 'Asistió SSBB', w: 96, titular: r => <SsbbPill texto={resumenSsbb(r)} ok={ssbbCompleto(r)} />, benef: b => <SsbbPill texto={b.welcome} ok={b.welcome === 'SI' ? true : b.welcome === 'NA' ? null : false} /> },
  { key: 'prixus', header: 'Prixus', w: 70, titular: r => r.prixus ? 'SI' : 'NO' },
  { key: 'r1', header: 'Referencia 1', w: 170, titular: r => r.referencias[0]?.nombre },
  { key: 'r1t', header: 'Teléfono', w: 116, titular: r => r.referencias[0]?.telefono },
  { key: 'r1p', header: 'Parentesco', w: 110, titular: r => r.referencias[0]?.parentesco },
  { key: 'r2', header: 'Referencia 2', w: 170, titular: r => r.referencias[1]?.nombre },
  { key: 'r2t', header: 'Teléfono', w: 116, titular: r => r.referencias[1]?.telefono },
  { key: 'r2p', header: 'Parentesco', w: 110, titular: r => r.referencias[1]?.parentesco },
  { key: 'ej', header: 'Ej. Training', w: 170, titular: r => r.comercial.ejecutivo },
  { key: 'fe', header: 'Full Executive', w: 160, titular: r => r.comercial.fullExecutive },
  { key: 'jg', header: 'Jefe de grupo', w: 160, titular: r => r.comercial.jefeGrupo },
  { key: 'ge', header: 'Gerente', w: 160, titular: r => r.comercial.gerente },
  { key: 'gd', header: 'Gerente división', w: 160, titular: r => r.comercial.gerenteDivision },
  { key: 'sm', header: 'Sales Manager', w: 160, titular: r => r.comercial.salesManager },
  { key: 'fil', header: 'Filial', w: 130, titular: r => r.comercial.filial },
  { key: 'ori', header: 'Origen matrícula', w: 190, titular: r => r.comercial.origenMatricula },
]
// Columna Motivo: solo en "Por resolver", después de la Cédula (antes del Teléfono).
const COL_MOTIVO: Col = {
  key: 'motivo', header: 'Motivo', w: 250,
  titular: r => (
    <span className="flex flex-wrap gap-1">
      {motivosDe(r).map(m => (
        <span key={m.label} title={m.ayuda} className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${m.cls}`}>{m.label}</span>
      ))}
    </span>
  ),
}
const COLS_POR_RESOLVER: Col[] = (() => {
  const i = COLS.findIndex(c => c.key === 'cedula') + 1
  return [...COLS.slice(0, i), COL_MOTIVO, ...COLS.slice(i)]
})()
// Pestaña Rechazados: fecha, motivo y quién lo rechazó, después de la Cédula.
const SIN_REGISTRO = <span className="italic text-gray-400">Sin registro</span>
const COLS_RECHAZO: Col[] = [
  { key: 'rechFecha', header: 'Fecha rechazo', w: 120, titular: r => r.rechazo?.fecha ? fmtFH(r.rechazo.fecha) : SIN_REGISTRO },
  { key: 'rechMotivo', header: 'Motivo del rechazo', w: 300, titular: r => r.rechazo?.motivo
      ? <span className="line-clamp-3" title={r.rechazo.motivo}>{r.rechazo.motivo}</span> : SIN_REGISTRO },
  { key: 'rechPor', header: 'Rechazado por', w: 170, titular: r => r.rechazo?.por || SIN_REGISTRO },
]
const COLS_RECHAZADOS: Col[] = (() => {
  const i = COLS.findIndex(c => c.key === 'cedula') + 1
  return [...COLS.slice(0, i), ...COLS_RECHAZO, ...COLS.slice(i)]
})()
/** Fijas = Item → Cédula titular; LEFTS = desplazamiento de cada columna fija. */
const layout = (cols: Col[]) => ({
  cols,
  fijas: cols.findIndex(c => c.key === 'cedula') + 1,
  lefts: cols.reduce<number[]>((acc, c, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + cols[i - 1].w); return acc }, []),
})
const LAYOUT_LIBRO = layout(COLS)
const LAYOUT_POR_RESOLVER = layout(COLS_POR_RESOLVER)
const LAYOUT_RECHAZADOS = layout(COLS_RECHAZADOS)
// Pestaña Papelera: las de Por resolver + cuándo entró y cuándo se borra.
const COLS_PAPELERA: Col[] = (() => {
  const i = COLS_POR_RESOLVER.findIndex(c => c.key === 'motivo') + 1
  return [...COLS_POR_RESOLVER.slice(0, i),
    { key: 'papDesde', header: 'En papelera desde', w: 124, titular: r => fmtFH(r.papeleraEn || null) },
    { key: 'papBorra', header: 'Se borra el', w: 130, titular: r => {
        const f = fechaBorrado(r.papeleraEn); const d = diasPara(f)
        return <span className={d !== null && d <= 5 ? 'font-semibold text-red-700' : ''}>{fmtF(f)}{d !== null ? ` (${d <= 0 ? 'hoy' : `${d} d`})` : ''}</span>
      } },
    ...COLS_POR_RESOLVER.slice(i)]
})()
const LAYOUT_PAPELERA = layout(COLS_PAPELERA)

// ── Página ──────────────────────────────────────────────────────────────────────
export default function LibroProduccionPage() {
  const { hasPermission, isLoading: permisosCargando } = usePermissions()
  const puedeVigencias = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_VIGENCIAS)
  const puedePlanes = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_PLANES)
  const puedeGestion = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_GESTION)
  // Cada pestaña tiene su permiso (SUPER_ADMIN/ADMIN ven todas).
  type Tab = 'libro' | 'sinFirmar' | 'rechazados' | 'papelera' | 'gestion' | 'vigencias' | 'planes'
  const TABS: [Tab, string, any][] = [
    ...(hasPermission(AprobacionPermission.LIBRO_PRODUCCION_LIBRO) ? [['libro', 'Libro', TableCellsIcon] as [Tab, string, any]] : []),
    ...(hasPermission(AprobacionPermission.LIBRO_PRODUCCION_POR_RESOLVER) ? [['sinFirmar', 'Por resolver', PencilSquareIcon] as [Tab, string, any]] : []),
    ...(hasPermission(AprobacionPermission.LIBRO_PRODUCCION_RECHAZADOS) ? [['rechazados', 'Rechazados', NoSymbolIcon] as [Tab, string, any]] : []),
    ...(hasPermission(AprobacionPermission.LIBRO_PRODUCCION_PAPELERA) ? [['papelera', 'Papelera', TrashIcon] as [Tab, string, any]] : []),
    ...(puedeGestion ? [['gestion', 'Gestión', PresentationChartBarIcon] as [Tab, string, any]] : []),
    ...(puedeVigencias ? [['vigencias', 'Vigencias', CalendarDaysIcon] as [Tab, string, any]] : []),
    ...(puedePlanes ? [['planes', 'Planes', RectangleStackIcon] as [Tab, string, any]] : []),
  ]
  const [tabSel, setTab] = useState<Tab | null>(null)
  const tab: Tab | null = tabSel && TABS.some(t => t[0] === tabSel) ? tabSel : (TABS[0]?.[0] ?? null)
  const esHoja = tab === 'libro' || tab === 'sinFirmar' || tab === 'rechazados' || tab === 'papelera'
  const [detalleGestion, setDetalleGestion] = useState<{ id: string; ids: string[] } | null>(null)
  // Pantalla completa: la hoja cubre todo (sin sidebar ni encabezado) y, si el
  // navegador lo permite, también entra en su modo de pantalla completa.
  const [completa, setCompleta] = useState(false)
  const abrirCompleta = () => {
    setCompleta(true)
    document.documentElement.requestFullscreen?.().catch(() => { /* la capa basta */ })
  }
  const volver = () => {
    setCompleta(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }
  useEffect(() => {
    if (!completa) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [completa])

  // La misma hoja pasa a cubrir la pantalla (no se vuelve a montar: conserva datos y filtros).
  return (
    <DashboardLayout>
      <PermissionGuard permission={AprobacionPermission.LIBRO_PRODUCCION_VER} showDefaultMessage>
        <div className={completa ? 'fixed inset-0 z-[60] bg-gray-50 overflow-auto p-4 space-y-3' : 'space-y-4'}>
          {completa ? (
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">Libro de Producción{tab === 'sinFirmar' ? ' · Por resolver' : tab === 'rechazados' ? ' · Rechazados' : tab === 'papelera' ? ' · Papelera' : ''}</h1>
            <button type="button" onClick={volver}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
              <ArrowUturnLeftIcon className="h-4 w-4" /> Volver
            </button>
          </div>
          ) : (<>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Libro de Producción</h1>
            <p className="text-sm text-gray-500">Contratos por vigencia comercial, con sus beneficiarios. Fuente: la plataforma (estado, pagos y plan en vivo).</p>
          </div>
          <div className="flex items-end gap-2 border-b border-gray-200">
            {TABS.map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
            {esHoja && (
              <button type="button" onClick={abrirCompleta} title="Ver el libro en pantalla completa, sin el menú lateral"
                className="ml-auto mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100">
                <ArrowsPointingOutIcon className="h-4 w-4" /> Pantalla completa
              </button>
            )}
          </div>
          </>)}
          {!tab ? (permisosCargando ? null : <p className="p-10 text-center text-sm text-gray-500">No tienes permiso para ninguna pestaña del libro.</p>)
            : esHoja ? <Libro key={tab} completa={completa} vista={tab === 'sinFirmar' ? 'resolver' : tab === 'rechazados' ? 'rechazados' : tab === 'papelera' ? 'papelera' : 'libro'} />
            : tab === 'gestion' ? <GestionComercialPanel onAbrirContrato={(id, ids) => setDetalleGestion({ id, ids })} />
            : tab === 'vigencias' ? <Vigencias /> : <PlanesTiposPanel />}
        </div>
        {/* Contrato abierto desde la lista de matrículas de la pestaña Gestión */}
        {detalleGestion && (
          <Detalle titularId={detalleGestion.id} ids={detalleGestion.ids}
            onNavegar={id => setDetalleGestion(d => (d ? { ...d, id } : d))} onClose={() => setDetalleGestion(null)}
            onCasillas={() => {}} onComercial={() => {}} />
        )}
      </PermissionGuard>
    </DashboardLayout>
  )
}

// ── Hoja ────────────────────────────────────────────────────────────────────────
function Libro({ completa = false, vista = 'libro' }: { completa?: boolean; vista?: Vista }) {
  const sinFirmar = vista === 'resolver'
  const enPapelera = vista === 'papelera'
  const { hasPermission } = usePermissions()
  const puedeExportar = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_EXPORTAR)
  const puedeBorrarPapelera = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_PAPELERA_BORRAR)
  // Papelera: selección múltiple (casilla por fila) para Restaurar / Borrar / CSV.
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [borrar, setBorrar] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  // Casilla de la celda Item, por fila: Ratificar por correo (sin firmar) o Depurar (firmado sin aprobar).
  const puedeRatificar = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_RATIFICAR)
  const puedeDepurar = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_DEPURAR)
  const accionDe = (r: Registro): 'ratificar' | 'depurar' | 'remover' | null =>
    // Sin firmar: Ratificar (con el correo) y, dentro de ese modal, Remover; sin permiso de ratificar, solo Remover.
    enPapelera || !esPendiente(r.aprobacion) ? null
    : !r.firmado ? (puedeRatificar ? 'ratificar' : puedeDepurar ? 'remover' : null)
    : puedeDepurar ? 'depurar' : null
  const conCasilla = (r: Registro) => accionDe(r) !== null
  const { cols: COLS, fijas: FIJAS, lefts: LEFTS } = sinFirmar ? LAYOUT_POR_RESOLVER : vista === 'rechazados' ? LAYOUT_RECHAZADOS : enPapelera ? LAYOUT_PAPELERA : LAYOUT_LIBRO
  const [accion, setAccion] = useState<{ id: string; tipo: 'ratificar' | 'depurar' | 'remover' } | null>(null)
  const [vigencias, setVigencias] = useState<Vigencia[]>([])
  const [vigencia, setVigencia] = useState<Vigencia | null>(null)
  const [todos, setRegistros] = useState<Registro[]>([])
  // Cada contrato cae en una sola pestaña (vistaDe). El Item se numera por pestaña.
  const registros = useMemo(() => todos
    .filter(r => vistaDe(r) === vista)
    .map((r, i) => ({ ...r, item: i + 1 })), [todos, vista])
  const [loading, setLoading] = useState(true)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [detalle, setDetalle] = useState<string | null>(null)
  const FILTROS_VACIOS = { semana: TODOS, pais: TODOS, estado: TODOS, ejecutivo: TODOS, filial: TODOS, conciliado: TODOS, factura: TODOS, q: '' }
  const [f, setF] = useState(FILTROS_VACIOS)
  // La vigencia no es un filtro de esta lista: "Limpiar filtros" la conserva.
  const hayFiltros = Object.entries(f).some(([k, v]) => (k === 'q' ? String(v).trim() !== '' : v !== TODOS))

  const cargar = useCallback(async (vigenciaId?: string) => {
    setLoading(true)
    try {
      // La Papelera no depende de la vigencia: trae todos los contratos que están en ella.
      const qs = enPapelera ? '?papelera=1' : vigenciaId ? `?vigenciaId=${encodeURIComponent(vigenciaId)}` : ''
      const d = await api.get<{ vigencias: Vigencia[]; vigencia: Vigencia | null; registros: Registro[] }>(`/api/postgres/libro-produccion${qs}`)
      setVigencias(d.vigencias || []); setVigencia(d.vigencia); setRegistros(d.registros || []); setAbiertos(new Set()); setSel(new Set())
    } catch (e) { handleApiError(e, 'No se pudo cargar el Libro de Producción') } finally { setLoading(false) }
  }, [enPapelera])
  useEffect(() => { cargar() }, [cargar])

  // Barra de desplazamiento horizontal superior, sincronizada con la de la tabla.
  const barraArriba = useRef<HTMLDivElement>(null)
  const tablaScroll = useRef<HTMLDivElement>(null)
  const sincronizando = useRef(false)
  const sincronizar = (origen: 'arriba' | 'tabla') => {
    if (sincronizando.current) { sincronizando.current = false; return }
    const de = origen === 'arriba' ? barraArriba.current : tablaScroll.current
    const a = origen === 'arriba' ? tablaScroll.current : barraArriba.current
    if (!de || !a || a.scrollLeft === de.scrollLeft) return
    sincronizando.current = true
    a.scrollLeft = de.scrollLeft
  }

  const opciones = useMemo(() => ({
    paises: Array.from(new Set(registros.map(r => r.pais || '—'))).sort(),
    estados: Array.from(new Set(registros.map(r => r.aprobacion))).sort(),
    ejecutivos: Array.from(new Set(registros.map(r => r.comercial.ejecutivo || '—'))).sort((a, b) => a.localeCompare(b, 'es')),
    // Filiales solo del país filtrado (Chile no muestra las de Ecuador o Colombia).
    filiales: Array.from(new Set(registros
      .filter(r => f.pais === TODOS || (r.pais || '—') === f.pais)
      .map(r => r.comercial.filial || '—'))).sort((a, b) => a.localeCompare(b, 'es')),
  }), [registros, f.pais])
  // Al cambiar de país se suelta una filial que no es de ese país.
  useEffect(() => {
    if (f.filial !== TODOS && !opciones.filiales.includes(f.filial)) setF(s => ({ ...s, filial: TODOS }))
  }, [opciones.filiales, f.filial])
  const semanas = vigencia ? semanasDeVigencia(vigencia) : []
  // Año: por defecto el de la vigencia cargada (la actual); el selector de vigencia muestra solo ese año.
  const anios = useMemo(() => Array.from(new Set(vigencias.map(v => v.anio))).sort((a, b) => b - a), [vigencias])
  const anioSel = vigencia?.anio ?? anios[0] ?? null

  const visibles = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return registros.filter(r =>
      (f.semana === TODOS || String(r.semana) === f.semana) &&
      (f.pais === TODOS || (r.pais || '—') === f.pais) &&
      (f.estado === TODOS || r.aprobacion === f.estado) &&
      (f.ejecutivo === TODOS || (r.comercial.ejecutivo || '—') === f.ejecutivo) &&
      (f.filial === TODOS || (r.comercial.filial || '—') === f.filial) &&
      (f.conciliado === TODOS || (f.conciliado === 'SI') === r.conciliado.si) &&
      (f.factura === TODOS || (f.factura === 'CON') === !!(r.factura && r.factura !== 'Admin')) &&
      (!q || [r.contrato, r.titular.nombre, r.titular.documento, r.titular.correo, ...r.beneficiarios.flatMap(b => [b.nombre, b.documento])]
        .some(s => String(s || '').toLowerCase().includes(q))))
  }, [registros, f])

  const toggle = (id: string) => setAbiertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todosSel = visibles.length > 0 && visibles.every(r => sel.has(r.titularId))
  const restaurar = async () => {
    if (!window.confirm(`¿Restaurar ${sel.size} contrato(s) a Por resolver? Tendrán 15 días más antes de volver a la Papelera.`)) return
    setProcesando(true)
    try {
      const d = await api.post<{ restaurados: string[] }>('/api/postgres/libro-produccion/papelera', { accion: 'restaurar', titularIds: Array.from(sel) })
      toast.success(`${d.restaurados.length} contrato(s) restaurado(s)`)
      cargar()
    } catch (e) { handleApiError(e, 'No se pudo restaurar') } finally { setProcesando(false) }
  }
  const conBenef = visibles.filter(r => r.beneficiarios.length)
  const todosAbiertos = conBenef.length > 0 && conBenef.every(r => abiertos.has(r.titularId))

  const exportar = () => {
    // Una fila por titular y una por beneficiario (columna Tipo), con las mismas columnas de la hoja.
    type Fila = { r: Registro; b: Benef | null }
    // En la Papelera: los seleccionados (o todos los visibles si no hay selección).
    const base = enPapelera && sel.size ? visibles.filter(r => sel.has(r.titularId)) : visibles
    const filas: Fila[] = base.flatMap(r => [{ r, b: null }, ...r.beneficiarios.map(b => ({ r, b }))])
    const txt = (v: any) => (v === null || v === undefined || typeof v === 'object' ? '' : v)
    exportToExcel<Fila>(filas, [
      { header: 'Tipo', accessor: x => x.b ? 'BENEFICIARIO' : 'TITULAR' },
      { header: 'Item', accessor: x => x.r.item },
      { header: 'Semana', accessor: x => x.r.semana ? etiquetaSemana(x.r.semana) : '' },
      { header: 'Fecha ingreso', accessor: x => fmtFH(x.r.creadoLocal) },
      { header: 'Fecha de pago', accessor: x => fmtF(x.r.fechaPago) },
      { header: 'N° Contrato', accessor: x => x.r.contrato },
      { header: 'Nombre', accessor: x => x.b ? x.b.nombre : x.r.titular.nombre },
      { header: 'Cédula', accessor: x => x.b ? x.b.documento : x.r.titular.documento },
      ...(sinFirmar ? [{ header: 'Motivo', accessor: (x: Fila) => x.b ? '' : textoMotivo(x.r) }] : []),
      ...(enPapelera ? [
        { header: 'En papelera desde', accessor: (x: Fila) => x.b ? '' : fmtFH(x.r.papeleraEn || null) },
        { header: 'Se borra el', accessor: (x: Fila) => x.b ? '' : fmtF(fechaBorrado(x.r.papeleraEn)) },
      ] : []),
      ...(vista === 'rechazados' ? [
        { header: 'Fecha rechazo', accessor: (x: Fila) => x.b ? '' : (x.r.rechazo?.fecha ? fmtFH(x.r.rechazo.fecha) : 'Sin registro') },
        { header: 'Motivo del rechazo', accessor: (x: Fila) => x.b ? '' : (x.r.rechazo?.motivo || 'Sin registro') },
        { header: 'Rechazado por', accessor: (x: Fila) => x.b ? '' : (x.r.rechazo?.por || 'Sin registro') },
      ] : []),
      { header: 'Teléfono', accessor: x => x.b ? x.b.telefono : x.r.titular.telefono },
      { header: 'Correo', accessor: x => x.b ? x.b.correo : x.r.titular.correo },
      { header: 'País', accessor: x => x.r.pais },
      { header: 'Dirección', accessor: x => x.b ? '' : x.r.titular.direccion },
      { header: 'Ciudad', accessor: x => x.b ? '' : x.r.titular.ciudad },
      { header: 'Plan', accessor: x => x.b ? '' : (x.r.plan ?? '') },
      { header: 'Tipo plan', accessor: x => x.b ? '' : x.r.tipoPlan },
      { header: 'Forma de pago', accessor: x => x.b ? '' : x.r.formaPago },
      { header: 'Conciliado', accessor: x => x.b ? '' : (x.r.conciliado.si ? 'SI' : 'NO') },
      { header: 'Inscripción pagada', accessor: x => x.b ? '' : x.r.inscripcionPagada },
      { header: 'Valor cuota', accessor: x => x.b ? '' : x.r.valorCuota },
      { header: 'Saldo', accessor: x => x.b ? '' : x.r.saldo },
      { header: 'Total plan', accessor: x => x.b ? '' : x.r.totalPlan },
      { header: 'Fecha 1ª cuota', accessor: x => x.b ? '' : fmtF(x.r.fechaPrimeraCuota) },
      { header: 'Suscripción de pago', accessor: x => x.b ? '' : (x.r.suscripcionPago ? 'SI' : 'NO') },
      { header: 'Factura/Bol', accessor: x => x.b ? '' : x.r.factura },
      { header: 'Aprobación', accessor: x => x.b ? (x.b.aprobacion || 'Pendiente') : x.r.aprobacion },
      { header: 'Observaciones', accessor: x => x.b ? '' : x.r.observaciones },
      { header: 'Programa', accessor: x => x.b ? x.b.programa : '' },
      { header: 'Asistió SSBB', accessor: x => x.b ? x.b.welcome : '' },
      { header: 'Prixus', accessor: x => x.b ? '' : (x.r.prixus ? 'SI' : 'NO') },
      ...[0, 1].flatMap(i => [
        { header: `Referencia ${i + 1}`, accessor: (x: Fila) => x.b ? '' : txt(x.r.referencias[i]?.nombre) },
        { header: 'Teléfono ref.', accessor: (x: Fila) => x.b ? '' : txt(x.r.referencias[i]?.telefono) },
        { header: 'Parentesco', accessor: (x: Fila) => x.b ? '' : txt(x.r.referencias[i]?.parentesco) },
      ]),
      { header: 'Ej. Training', accessor: x => x.r.comercial.ejecutivo },
      { header: 'Full Executive', accessor: x => x.r.comercial.fullExecutive },
      { header: 'Jefe de grupo', accessor: x => x.r.comercial.jefeGrupo },
      { header: 'Gerente', accessor: x => x.r.comercial.gerente },
      { header: 'Gerente división', accessor: x => x.r.comercial.gerenteDivision },
      { header: 'Sales Manager', accessor: x => x.r.comercial.salesManager },
      { header: 'Filial', accessor: x => x.r.comercial.filial },
      { header: 'Origen matrícula', accessor: x => x.r.comercial.origenMatricula },
    ], enPapelera ? `libro-produccion-papelera-${new Date().toISOString().slice(0, 10)}` : `libro-produccion-${sinFirmar ? 'por-resolver-' : vista === 'rechazados' ? 'rechazados-' : ''}${vigencia ? etiquetaVigencia(vigencia).replace(' ', '-') : 'sin-vigencia'}`)
  }

  const Sel = ({ label, k, opts }: { label: string; k: keyof typeof f; opts: [string, string][] }) => (
    <label className="text-xs text-gray-600 min-w-0">
      <span className="block mb-0.5">{label}</span>
      <select value={f[k]} onChange={e => setF(s => ({ ...s, [k]: e.target.value }))}
        className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-sm text-gray-800">
        <option value={TODOS}>Todos</option>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  )

  return (
    <div className="space-y-3 min-w-0">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        {!enPapelera && <>
        <label className="text-xs text-gray-600 min-w-0">
          <span className="block mb-0.5">Año</span>
          <select value={anioSel ?? ''}
            onChange={e => {
              const a = Number(e.target.value)
              setF(s => ({ ...s, semana: TODOS }))
              if (a === new Date().getFullYear()) { cargar(); return }   // el servidor elige la vigencia actual
              const del = vigencias.filter(v => v.anio === a).sort((x, y) => y.mes - x.mes)
              if (del[0]) cargar(del[0]._id)
            }}
            className="w-full rounded-md border border-indigo-300 bg-indigo-50 py-1.5 pl-2 pr-7 text-sm font-semibold text-indigo-900">
            {!anios.length && <option value="">—</option>}
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 min-w-0">
          <span className="block mb-0.5">Vigencia</span>
          <select value={vigencia?._id || ''} onChange={e => { setF(s => ({ ...s, semana: TODOS })); cargar(e.target.value) }}
            className="w-full rounded-md border border-indigo-300 bg-indigo-50 py-1.5 pl-2 pr-7 text-sm font-semibold text-indigo-900">
            {!vigencias.length && <option value="">Sin vigencias</option>}
            {vigencias.filter(v => v.anio === anioSel).map(v => <option key={v._id} value={v._id}>{etiquetaVigencia(v)}</option>)}
          </select>
        </label>
        <Sel label="Semana" k="semana" opts={semanas.map(s => [String(s.numero), `${s.etiqueta} (${fmtF(s.inicio)})`])} />
        </>}
        <Sel label="País" k="pais" opts={opciones.paises.map(p => [p, p])} />
        <Sel label="Aprobación" k="estado" opts={opciones.estados.map(p => [p, p])} />
        <Sel label="Ejecutivo" k="ejecutivo" opts={opciones.ejecutivos.map(p => [p, p])} />
        <Sel label="Filial" k="filial" opts={opciones.filiales.map(p => [p, p === '—' ? 'Sin filial' : p])} />
        <Sel label="Conciliado" k="conciliado" opts={[['SI', 'Sí'], ['NO', 'No']]} />
        <Sel label="Factura" k="factura" opts={[['CON', 'Con número'], ['SIN', 'Sin número / Admin']]} />
        <label className="text-xs text-gray-600 min-w-0 col-span-2 sm:col-span-3 md:col-span-4 xl:col-span-8">
          <span className="block mb-0.5">Buscar</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={f.q} onChange={e => setF(s => ({ ...s, q: e.target.value }))} placeholder="Contrato, nombre, cédula o correo…"
              className="w-full rounded-md border border-gray-300 py-1.5 pl-7 pr-2 text-sm" />
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {enPapelera && <span>Contratos con 15 días o más en <b className="text-gray-700">Por resolver</b>, sin pagos validados ni clases. El sistema los borra a los <b className="text-red-700">{BORRADO_DIAS} días</b> de entrar.</span>}
          {!enPapelera && vigencia && <span>Vigencia <b className="text-gray-700">{etiquetaVigencia(vigencia)}</b>: {fmtFH(vigencia.inicio)} → {fmtFH(vigencia.fin)} (hora local de cada país)</span>}
          <span><b className="text-gray-700">{visibles.length}</b> contratos · <b className="text-gray-700">{visibles.reduce((s, r) => s + r.beneficiarios.length, 0)}</b> beneficiarios</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setF(FILTROS_VACIOS)} disabled={!hayFiltros}
            title="Quitar todos los filtros (conserva la vigencia)"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <FunnelIcon className="h-4 w-4" /> Limpiar filtros
          </button>
          <button type="button" onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(conBenef.map(r => r.titularId)))}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50">
            {todosAbiertos ? 'Colapsar beneficiarios' : 'Expandir beneficiarios'}
          </button>
          <button type="button" onClick={() => cargar(vigencia?._id)} disabled={loading} title="Actualizar"
            className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {enPapelera && (
            <button type="button" onClick={() => setSel(todosSel ? new Set() : new Set(visibles.map(r => r.titularId)))} disabled={!visibles.length}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40">
              {todosSel ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
          )}
          {enPapelera && puedeBorrarPapelera && (<>
            <button type="button" onClick={restaurar} disabled={!sel.size || procesando}
              title="Devolver a Por resolver (15 días más antes de volver a la Papelera)"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-40">
              <ArrowUturnLeftIcon className="h-4 w-4" /> Restaurar{sel.size ? ` (${sel.size})` : ''}
            </button>
            <button type="button" onClick={() => setBorrar(true)} disabled={!sel.size || procesando}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-40">
              <TrashIcon className="h-4 w-4" /> Borrar{sel.size ? ` (${sel.size})` : ''}
            </button>
          </>)}
          {puedeExportar && (
            <button type="button" onClick={exportar} disabled={!visibles.length}
              title={enPapelera ? 'Descarga los seleccionados, o todos si no hay selección' : undefined}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
              <ArrowDownTrayIcon className="h-4 w-4" /> {enPapelera ? `Descargar CSV${sel.size ? ` (${sel.size})` : ''}` : 'Exportar Excel'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="p-10 text-center text-sm text-gray-400 italic">Cargando…</p>
      ) : !enPapelera && !vigencias.length ? (
        <p className="p-10 text-center text-sm text-gray-500">No hay vigencias configuradas. Genere el calendario en la pestaña <b>Vigencias</b>.</p>
      ) : (
        <>
        <div ref={barraArriba} onScroll={() => sincronizar('arriba')}
          className="overflow-x-auto overflow-y-hidden rounded-t-lg border border-b-0 border-gray-300 bg-white" aria-hidden="true">
          <div style={{ width: COLS.reduce((s, c) => s + c.w, 0), height: 1 }} />
        </div>
        <div ref={tablaScroll} onScroll={() => sincronizar('tabla')}
          className={`overflow-auto rounded-b-lg border border-gray-300 bg-white ${completa ? 'max-h-[calc(100vh-14rem)]' : 'max-h-[70vh]'}`}>
          <table className="border-separate border-spacing-0 text-xs" style={{ width: COLS.reduce((s, c) => s + c.w, 0) }}>
            <thead>
              <tr>
                {COLS.map((c, i) => (
                  <th key={c.key} style={{ width: c.w, minWidth: c.w, left: i < FIJAS ? LEFTS[i] : undefined }}
                    className={`sticky top-0 z-20 bg-blue-900 text-white font-semibold px-2 py-2 text-left border-b border-r border-blue-800 whitespace-nowrap ${i < FIJAS ? 'z-30' : ''} ${i === FIJAS - 1 ? 'shadow-[2px_0_0_0_rgba(0,0,0,0.25)]' : ''}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(r => {
                const abierto = abiertos.has(r.titularId)
                return (
                  <Fragment key={r.titularId}>
                    <tr className="group">
                      {COLS.map((c, i) => (
                        <td key={c.key} style={{ width: c.w, minWidth: c.w, left: i < FIJAS ? LEFTS[i] : undefined }}
                          className={`px-2 py-1.5 border-b border-r border-gray-200 align-top ${i < FIJAS ? 'sticky z-10 bg-white group-hover:bg-indigo-50' : 'group-hover:bg-indigo-50/60'} ${i === FIJAS - 1 ? 'shadow-[2px_0_0_0_rgba(0,0,0,0.12)]' : ''}`}>
                          {c.key === 'item' ? (
                            <span className="inline-flex items-center gap-0.5">
                              {r.beneficiarios.length > 0 ? (
                                <button type="button" onClick={() => toggle(r.titularId)} title={abierto ? 'Ocultar beneficiarios' : 'Ver beneficiarios'} className="text-gray-500 hover:text-indigo-700">
                                  {abierto ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                                </button>
                              ) : <span className="w-3.5" />}
                              {enPapelera && (
                                <input type="checkbox" checked={sel.has(r.titularId)} onChange={() => toggleSel(r.titularId)}
                                  title="Seleccionar para Restaurar, Borrar o Descargar CSV"
                                  className="mx-0.5 h-3.5 w-3.5 cursor-pointer rounded accent-red-600" />
                              )}
                              {conCasilla(r) && (
                                <input type="checkbox" checked={accion?.id === r.titularId} onChange={() => setAccion({ id: r.titularId, tipo: accionDe(r)! })}
                                  title={accionDe(r) === 'ratificar' ? 'Ratificar con el correo "SÍ, ACEPTO" (o remover el contrato)' : accionDe(r) === 'remover' ? 'Remover este contrato y sus registros' : 'Depurar este contrato (firmado sin aprobar)'}
                                  className={`mx-0.5 h-3.5 w-3.5 cursor-pointer rounded ${accionDe(r) === 'ratificar' ? 'accent-emerald-600' : 'accent-red-600'}`} />
                              )}
                              {r.item}
                            </span>
                          ) : c.key === 'contrato' || c.key === 'titular' ? (
                            <button type="button" onClick={() => setDetalle(r.titularId)} className="text-left font-medium text-indigo-700 hover:underline">{c.titular(r)}</button>
                          ) : c.titular(r)}
                        </td>
                      ))}
                    </tr>
                    {abierto && r.beneficiarios.map(b => (
                      <tr key={b.id} className="text-gray-600">
                        {COLS.map((c, i) => (
                          <td key={c.key} style={{ width: c.w, minWidth: c.w, left: i < FIJAS ? LEFTS[i] : undefined }}
                            className={`px-2 py-1 border-b border-r border-gray-100 ${i < FIJAS ? 'sticky z-10 bg-slate-50' : 'bg-slate-50/70'} ${i === FIJAS - 1 ? 'shadow-[2px_0_0_0_rgba(0,0,0,0.12)]' : ''}`}>
                            {c.key === 'titular' ? <span className="pl-3">↳ {b.nombre}</span> : c.benef ? c.benef(b) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              {!visibles.length && (
                <tr><td colSpan={COLS.length} className="p-8 text-center text-sm text-gray-400">{enPapelera && !registros.length ? 'La Papelera está vacía.' : 'No hay contratos con esos filtros.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {borrar && (
        <BorrarPapeleraModal cantidad={sel.size} contratos={visibles.filter(r => sel.has(r.titularId)).map(r => r.contrato)}
          onClose={() => setBorrar(false)}
          onConfirmar={async (motivo) => {
            setProcesando(true)
            try {
              const d = await api.post<{ borrados: string[]; omitidos: { contrato: string; razon: string }[] }>(
                '/api/postgres/libro-produccion/papelera', { accion: 'borrar', titularIds: Array.from(sel), motivo, confirmado: true })
              toast.success(`${d.borrados.length} contrato(s) borrado(s)`)
              if (d.omitidos.length) toast.error(`No se borraron: ${d.omitidos.map(o => `${o.contrato} — ${o.razon}`).join('; ')}`, { duration: 9000 })
              setBorrar(false); cargar()
            } catch (e) { handleApiError(e, 'No se pudo borrar') } finally { setProcesando(false) }
          }} />
      )}

      {accion && (
        <LibroAccionModal titularId={accion.id} accion={accion.tipo}
          onClose={() => setAccion(null)} onDone={() => { setAccion(null); cargar(vigencia?._id) }} />
      )}

      {detalle && (
        <Detalle titularId={detalle} ids={visibles.map(r => r.titularId)} onNavegar={setDetalle} onClose={() => setDetalle(null)}
          onCasillas={(id, c) => setRegistros(rs => rs.map(r => r.titularId === id ? { ...r, ...c } : r))}
          onComercial={(id, comercial) => setRegistros(rs => rs.map(r => r.titularId === id ? { ...r, comercial } : r))} />
      )}
    </div>
  )
}

// ── Vista detallada (ventana ampliada, dos columnas; pantalla completa en celular) ──
function Detalle({ titularId, ids, onNavegar, onClose, onCasillas, onComercial }: {
  titularId: string
  /** Contratos del filtro actual, en el orden de la hoja (para Anterior / Siguiente). */
  ids: string[]
  onNavegar: (id: string) => void
  onClose: () => void
  onCasillas: (id: string, c: { suscripcionPago: boolean; prixus: boolean }) => void
  onComercial: (id: string, comercial: Registro['comercial']) => void
}) {
  const { hasPermission } = usePermissions()
  const puedeCasillas = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_CASILLAS)
  const puedeSeguimiento = hasPermission(PersonPermission.SEGUIMIENTO as any)
  const [verSeguimiento, setVerSeguimiento] = useState(false)
  const puedeEscalera = hasPermission(AprobacionPermission.LIBRO_PRODUCCION_ESCALERA)
  const [verEscalera, setVerEscalera] = useState(false)
  const [r, setR] = useState<Registro | null>(null)
  const [vig, setVig] = useState<Vigencia | null>(null)
  const [guardando, setGuardando] = useState(false)
  const idx = ids.indexOf(titularId)
  const anterior = idx > 0 ? ids[idx - 1] : null
  const siguiente = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null

  useEffect(() => {
    let vivo = true
    setR(null)
    api.get<{ registro: Registro; vigencia: Vigencia | null }>(`/api/postgres/libro-produccion/${titularId}`)
      .then(d => { if (vivo) { setR(d.registro); setVig(d.vigencia) } })
      .catch(e => { handleApiError(e, 'No se pudo cargar el contrato'); onClose() })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titularId])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (verSeguimiento || verEscalera) return // esas ventanas manejan su propio Esc
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && anterior) onNavegar(anterior)
      else if (e.key === 'ArrowRight' && siguiente) onNavegar(siguiente)
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose, onNavegar, anterior, siguiente, verSeguimiento, verEscalera])

  const marcar = async (campo: 'suscripcionPago' | 'prixus', valor: boolean) => {
    if (!r) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/postgres/libro-produccion/${r.titularId}/casillas`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      const c = { suscripcionPago: j.casillas.suscripcionPago, prixus: j.casillas.prixus }
      setR({ ...r, ...c }); onCasillas(r.titularId, c)
      toast.success('Guardado')
    } catch (e: any) { toast.error(`No se pudo guardar: ${e?.message || ''}`) } finally { setGuardando(false) }
  }

  const F = ({ l, v, full }: { l: string; v: React.ReactNode; full?: boolean }) => (
    <div className={full ? 'col-span-full min-w-0' : 'min-w-0'}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{l}</div>
      <div className="text-sm text-gray-900 break-words">{v || '—'}</div>
    </div>
  )
  const Sec = ({ t, children, accion }: { t: string; children: React.ReactNode; accion?: React.ReactNode }) => (
    <section className="rounded-xl border border-gray-200 bg-white min-w-0">
      <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-800 flex items-center justify-between gap-2">{t}{accion}</div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">{children}</div>
    </section>
  )
  const BtnNav = ({ id, children, title }: { id: string | null; children: React.ReactNode; title: string }) => (
    <button type="button" disabled={!id} onClick={() => id && onNavegar(id)} title={title}
      className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25 disabled:opacity-40">
      {children}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center overflow-y-auto sm:p-4" onClick={onClose}>
      <div className="w-full min-h-full sm:min-h-0 sm:max-w-[1400px] sm:my-4 bg-gray-50 sm:rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Encabezado fijo: contrato, estado, navegación */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 sm:px-5 py-3 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide opacity-80">
                Contrato {r?.contrato || '…'} · {r?.pais || '—'}{idx >= 0 ? ` · ${idx + 1} de ${ids.length}` : ''}
              </div>
              <div className="text-lg sm:text-xl font-bold truncate">{r?.titular.nombre || 'Cargando…'}</div>
              {r && (
                <div className="text-xs opacity-90">
                  {vig ? `${etiquetaVigencia(vig)} · Semana ${r.semana ? etiquetaSemana(r.semana) : '—'}` : 'Fuera de las vigencias configuradas'} · Ingreso {fmtFH(r.creadoLocal)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r && <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoCls(r.aprobacion)}`}>{r.aprobacion}</span>}
              <button type="button" onClick={onClose} title="Cerrar (Esc)" className="text-white/80 hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BtnNav id={anterior} title="Contrato anterior (←)"><ChevronLeftIcon className="h-4 w-4" /> Anterior</BtnNav>
              <BtnNav id={siguiente} title="Contrato siguiente (→)">Siguiente <ChevronRightIcon className="h-4 w-4" /></BtnNav>
            </div>
            {r && (
              <div className="flex items-center gap-2">
                {puedeSeguimiento && (
                  <button type="button" onClick={() => setVerSeguimiento(true)} title="Todo lo que ha pasado con el contrato: quién y cuándo"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-gray-900 hover:bg-amber-500">
                    <ClockIcon className="h-4 w-4" /> Seguimiento
                  </button>
                )}
                <a href={`/person/${r.titularId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" /> Ver ficha completa
                </a>
              </div>
            )}
            {verSeguimiento && r && <SeguimientoContratoModal personaId={r.titularId} onClose={() => setVerSeguimiento(false)} />}
            {verEscalera && r && (
              <AjusteEscaleraModal titularId={r.titularId} contrato={r.contrato} onClose={() => setVerEscalera(false)}
                onGuardado={c => {
                  const comercial = {
                    ...r.comercial,
                    ejecutivo: c.asesorCreadorContrato || r.comercial.ejecutivo,
                    fullExecutive: c.fullExecutive || '', jefeGrupo: c.jefeGrupo || '', gerente: c.gerente || '',
                    gerenteDivision: c.gerenteDivision || '', salesManager: c.salesManager || '',
                    filial: c.filial || '', origenMatricula: c.origenMatricula || '',
                  }
                  setR({ ...r, comercial }); onComercial(r.titularId, comercial)
                }} />
            )}
          </div>
        </div>

        {!r ? (
          <div className="p-12 text-center text-sm text-gray-400">Cargando…</div>
        ) : (
          <div className="p-3 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className="grid gap-4 min-w-0">
                <Sec t="Titular">
                  <F l="Cédula" v={r.titular.documento} /><F l="Teléfono" v={r.titular.telefono} /><F l="País" v={r.pais} />
                  <F l="Correo" v={r.titular.correo} full />
                  <F l="Dirección" v={r.titular.direccion} /><F l="Ciudad" v={r.titular.ciudad} />
                </Sec>
                <Sec t="Plan">
                  <F l="Plan (cuotas)" v={r.plan ?? '—'} /><F l="Tipo plan" v={r.tipoPlan} /><F l="Valor cuota" v={fmtM(r.valorCuota)} />
                  <F l="Saldo" v={fmtM(r.saldo)} /><F l="Total plan" v={fmtM(r.totalPlan)} /><F l="Fecha 1ª cuota" v={fmtF(r.fechaPrimeraCuota)} />
                </Sec>
                <section className="rounded-xl border border-gray-200 bg-white min-w-0">
                  <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-800">Control</div>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-6">
                      {([['suscripcionPago', 'Suscripción de pago'], ['prixus', 'Prixus']] as const).map(([k, l]) => (
                        <label key={k} className={`inline-flex items-center gap-2 text-sm ${puedeCasillas ? 'cursor-pointer' : 'opacity-80'}`}>
                          <input type="checkbox" checked={r[k]} disabled={!puedeCasillas || guardando} onChange={e => marcar(k, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                          {l}
                        </label>
                      ))}
                    </div>
                    <F l="Observaciones" v={r.observaciones} />
                  </div>
                </section>
              </div>
              <div className="grid gap-4 min-w-0">
                <Sec t="Pago de inscripción">
                  <F l="Fecha de pago" v={fmtF(r.fechaPago)} /><F l="Forma de pago" v={r.formaPago} /><F l="Inscripción pagada" v={fmtM(r.inscripcionPagada)} />
                  <F l="Conciliado" v={r.conciliado.si ? `SI · ${r.conciliado.por || ''} ${r.conciliado.fecha ? fmtF(r.conciliado.fecha) : ''}` : 'NO'} />
                  <F l="Factura / boleta" v={r.factura} />
                </Sec>
                <Sec t="Comercial (escala del día de la matrícula)" accion={puedeEscalera && (
                  <button type="button" onClick={() => setVerEscalera(true)} title="Corregir la escala comercial de este contrato"
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
                    <PencilSquareIcon className="h-3.5 w-3.5" /> Ajuste Escala
                  </button>
                )}>
                  <F l="Ej. Training" v={r.comercial.ejecutivo} /><F l="Full Executive" v={r.comercial.fullExecutive} /><F l="Jefe de grupo" v={r.comercial.jefeGrupo} />
                  <F l="Gerente" v={r.comercial.gerente} /><F l="Gerente división" v={r.comercial.gerenteDivision} /><F l="Sales Manager" v={r.comercial.salesManager} />
                  <F l="Filial" v={r.comercial.filial} /><F l="Origen matrícula" v={r.comercial.origenMatricula} />
                </Sec>
                <Sec t="Referencias">
                  {r.referencias.map((x, i) => (
                    <Fragment key={i}><F l={`Referencia ${i + 1}`} v={x.nombre} /><F l="Teléfono" v={x.telefono} /><F l="Parentesco" v={x.parentesco} /></Fragment>
                  ))}
                </Sec>
              </div>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white">
              <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-800">Beneficiarios ({r.beneficiarios.length})</div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {r.beneficiarios.map(b => (
                  <div key={b.id} className="rounded-xl border border-gray-200 overflow-hidden min-w-0">
                    <div className={`px-4 py-2 text-white flex items-center justify-between gap-2 ${b.programa === 'Kids' ? 'bg-fuchsia-600' : 'bg-emerald-600'}`}>
                      <span className="font-semibold truncate">{b.nombre}</span>
                      <span className="shrink-0 text-[10px] font-bold bg-white/25 rounded-full px-2 py-0.5">{b.programa === 'Kids' ? '🧒 KIDS' : 'LGS'}</span>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2">
                      <F l="Cédula" v={b.documento} /><F l="Teléfono" v={b.telefono} />
                      <F l="Correo" v={b.correo} full />
                      <F l="Asistió SSBB" v={<SsbbPill texto={b.welcome === 'SI' ? 'Sí asistió' : b.welcome === 'NA' ? 'No aplica (Kids)' : 'No ha asistido'} ok={b.welcome === 'SI' ? true : b.welcome === 'NA' ? null : false} />} />
                      <F l="Estado" v={b.aprobacion || 'Pendiente'} />
                    </div>
                  </div>
                ))}
                {!r.beneficiarios.length && <p className="text-sm text-gray-500">Sin beneficiarios.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vigencias ───────────────────────────────────────────────────────────────────
function Vigencias() {
  const [vigencias, setVigencias] = useState<Vigencia[]>([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [inicioEnero, setInicioEnero] = useState('')
  const [hora, setHora] = useState('09:00')
  const [fines, setFines] = useState<string[]>(Array(12).fill(''))
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const d = await api.get<{ vigencias: Vigencia[] }>('/api/postgres/libro-produccion/vigencias')
      setVigencias(d.vigencias || [])
    } catch (e) { handleApiError(e, 'No se pudieron cargar las vigencias') }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Al cambiar de año se precarga lo que ya exista; si no, enero empieza donde terminó diciembre anterior.
  useEffect(() => {
    const del = vigencias.filter(v => v.anio === anio).sort((a, b) => a.mes - b.mes)
    if (del.length) {
      setInicioEnero(del[0].inicio.slice(0, 10)); setHora(del[0].inicio.slice(11, 16) || '09:00')
      setFines(Array.from({ length: 12 }, (_, i) => del.find(v => v.mes === i + 1)?.fin.slice(0, 10) || ''))
    } else {
      const dic = vigencias.find(v => v.anio === anio - 1 && v.mes === 12)
      setInicioEnero(dic ? dic.fin.slice(0, 10) : ''); setFines(Array(12).fill(''))
    }
  }, [anio, vigencias])

  const inicioDe = (i: number) => (i === 0 ? inicioEnero : fines[i - 1])
  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/postgres/libro-produccion/vigencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anio, inicioEnero, fines, hora }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success(`Vigencias ${anio} guardadas`); cargar()
    } catch (e: any) { toast.error(e?.message || 'No se pudo guardar') } finally { setGuardando(false) }
  }

  const dias = (a: string, b: string) => a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : null

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm text-gray-600">
          Escriba el <b>primer día de la vigencia de enero</b> y el <b>último día de cada mes</b>. Cada mes empieza donde terminó el anterior.
          El corte es a la hora indicada en la <b>hora local de cada país</b>. Las semanas se arman solas en bloques de 7 días (la última absorbe los días sobrantes).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600"><span className="block mb-0.5">Año</span>
            <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-gray-600"><span className="block mb-0.5">Primer día de enero</span>
            <input type="date" value={inicioEnero} onChange={e => setInicioEnero(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-gray-600"><span className="block mb-0.5">Hora de corte</span>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></label>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-1.5">Mes</th><th>Inicio</th><th>Último día (fin)</th><th>Días</th><th>Semanas</th>
          </tr></thead>
          <tbody>
            {MESES.map((m, i) => {
              const ini = inicioDe(i); const d = dias(ini, fines[i])
              const sem = ini && fines[i] && d && d > 0 ? semanasDeVigencia({ inicio: `${ini}T${hora}`, fin: `${fines[i]}T${hora}` }) : []
              return (
                <tr key={m} className="border-b border-gray-100">
                  <td className="py-1.5 font-medium text-gray-800">{m}</td>
                  <td className="text-gray-600">{ini ? `${fmtF(ini)} ${hora}` : '—'}</td>
                  <td><input type="date" value={fines[i]} onChange={e => setFines(fs => fs.map((x, j) => j === i ? e.target.value : x))}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm" /> <span className="text-xs text-gray-400">{hora}</span></td>
                  <td className={d !== null && d <= 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{d ?? '—'}</td>
                  <td className="text-xs text-gray-500">{sem.map(s => `${s.etiqueta} ${fmtF(s.inicio).slice(0, 5)}`).join(' · ') || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex justify-end">
          <button type="button" onClick={guardar} disabled={guardando}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : `Guardar vigencias ${anio}`}
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500">
        Años configurados: {Array.from(new Set(vigencias.map(v => v.anio))).sort().join(', ') || 'ninguno'}
      </div>
    </div>
  )
}

// ── Papelera: confirmación de borrado definitivo ──────────────────────────────────
function BorrarPapeleraModal({ cantidad, contratos, onClose, onConfirmar }: {
  cantidad: number; contratos: string[]; onClose: () => void; onConfirmar: (motivo: string) => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const valido = motivo.trim().length >= 10 && ok
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-3 rounded-t-lg">
          <h2 className="flex items-center gap-2 text-base font-bold text-red-800"><TrashIcon className="h-5 w-5" /> Borrar {cantidad} contrato(s) de la Papelera</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <p className="text-gray-700">Se borran definitivamente el contrato, sus beneficiarios, financieros, pagos no validados y fichas académicas sin clases (las compartidas con otro contrato se conservan). Queda copia en el registro de depuraciones. Antes de borrar se vuelve a revisar que no tengan pagos validados ni clases.</p>
          <p className="max-h-24 overflow-auto rounded bg-gray-50 p-2 font-mono text-xs text-gray-700">{contratos.join(', ')}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-700">Motivo (mínimo 10 caracteres)</span>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              className="w-full rounded-md border border-gray-300 p-2 text-sm" placeholder="Ej.: contratos abandonados sin firma ni pago" />
          </label>
          <label className="flex items-start gap-2 text-xs text-red-800">
            <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-0.5 accent-red-600" />
            Entiendo que se borran el contrato y sus registros, y que no se puede deshacer.
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">Cancelar</button>
          <button type="button" disabled={!valido || enviando}
            onClick={async () => { setEnviando(true); try { await onConfirmar(motivo.trim()) } finally { setEnviando(false) } }}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-40">
            {enviando ? 'Borrando…' : 'Borrar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  )
}
