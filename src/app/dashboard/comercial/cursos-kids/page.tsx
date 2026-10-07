'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon, AcademicCapIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { exportToExcel } from '@/lib/export-excel'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { cursoColorCls } from '@/components/comercial/KidsCursoTexto'
import { PermissionGuard } from '@/components/permissions'
import { ComercialPermission } from '@/types/permissions'

interface Slot { tipo: string; diaSemana: number; horaLocal: string; duracionMin: number }
interface Salon {
  id: string; nombre: string; pais?: string | null
  cupo: number; ocupados: number; cupoDisponible: number; lleno?: boolean; activo?: boolean
  guia: string | null; horario: Slot[]
}
interface Curso { tipo: string; inicio?: string | null; finalCurso?: string | null; salones: Salon[] }
interface Campania { id: string; nombre: string; inicio: string; fin: string; finalVenta?: string; cursos: Curso[] }

// Mismas etiquetas que el panel de campañas de KIDS (país = calendario de feriados del salón).
const PAIS: Record<string, string> = { CL: 'Chile', CO: 'Colombia', EC: 'Ecuador', PE: 'Perú' }
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const ORDEN_CURSO: Record<string, number> = { JUNIOR: 0, YOUNGSTER: 1 }

const fmtFecha = (v?: string | null) => {
  const [y, m, d] = String(v || '').slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '—'
}
const horaFin = (inicio: string, dur: number) => {
  const [h, m] = inicio.split(':').map(Number)
  const t = (h || 0) * 60 + (m || 0) + dur
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
/** Igual que el panel de KIDS: agrupa los días por hora → "LUN-MIÉ 17:00-18:00". */
const resumenHorario = (horario: Slot[]) => {
  if (!horario?.length) return '—'
  const grupos = new Map<string, { dias: number[]; dur: number; tipo: string }>()
  for (const s of horario) {
    const clave = `${s.horaLocal}|${s.tipo}`
    const g = grupos.get(clave) ?? { dias: [], dur: s.duracionMin, tipo: s.tipo }
    g.dias.push(s.diaSemana)
    grupos.set(clave, g)
  }
  return Array.from(grupos.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([clave, g]) => {
      const hora = clave.split('|')[0]
      const dias = g.dias.sort((a, b) => a - b).map(d => DIAS[d] ?? '?').join('-')
      return `${dias} ${hora}-${horaFin(hora, g.dur)}${g.tipo === 'CLUB' ? ' (Club)' : ''}`
    })
    .join(' · ')
}
/** "JUNIOR Salón 01" → "Salón 01" (el curso ya va en su columna). */
const etiquetaSalon = (nombre: string, tipo: string) => nombre.replace(new RegExp(`^${tipo}\\s+`, 'i'), '')
const esActivo = (s: Salon) => s.activo !== false
// "lleno" lo envía KIDS; si no, se deduce del cupo.
const estaLleno = (s: Salon) => s.lleno === true || s.ocupados >= s.cupo

type FiltroEstado = 'TODOS' | 'ACTIVO' | 'INACTIVO'

export default function CursosKidsPage() {
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [consultado, setConsultado] = useState<string | null>(null)
  const [pais, setPais] = useState('')
  const [curso, setCurso] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('TODOS')
  const [soloConCupo, setSoloConCupo] = useState(false)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/postgres/kids-intake/cursos', { cache: 'no-store' })
      const j = await res.json()
      if (j?.success === false) throw new Error(j.error || 'Error al consultar')
      setConfigured(j.configured !== false)
      setError(j.error || null)
      setCampanias(Array.isArray(j.campanias) ? j.campanias : [])
      setConsultado(j.consultado || new Date().toISOString())
    } catch (e: any) {
      setError(e?.message || 'Error al consultar KIDS2026')
      setCampanias([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const vista = useMemo(() => campanias.map(c => ({
    ...c,
    cursos: c.cursos
      .slice()
      .sort((a, b) => (ORDEN_CURSO[a.tipo] ?? 9) - (ORDEN_CURSO[b.tipo] ?? 9))
      .filter(cu => !curso || cu.tipo === curso)
      .map(cu => ({
        ...cu,
        salones: cu.salones.filter(s =>
          (!pais || s.pais === pais) &&
          (estado === 'TODOS' || esActivo(s) === (estado === 'ACTIVO')) &&
          (!soloConCupo || (esActivo(s) && !estaLleno(s)))),
      }))
      .filter(cu => cu.salones.length > 0),
  })), [campanias, pais, curso, estado, soloConCupo])

  const tiposCurso = Array.from(new Set(campanias.flatMap(c => c.cursos.map(cu => cu.tipo))))
    .sort((a, b) => (ORDEN_CURSO[a] ?? 9) - (ORDEN_CURSO[b] ?? 9))
  const paises = Array.from(new Set(campanias.flatMap(c => c.cursos.flatMap(cu => cu.salones.map(s => s.pais || ''))))).filter(Boolean).sort()
  const todos = campanias.flatMap(c => c.cursos.flatMap(cu => cu.salones))
  // Los indicadores cuentan solo salones ACTIVOS (los únicos que se ofrecen al inscribir).
  const activos = todos.filter(esActivo)
  const totalCupo = activos.reduce((a, s) => a + s.cupo, 0)
  const totalDisp = activos.reduce((a, s) => a + Math.max(0, s.cupoDisponible), 0)
  const llenos = activos.filter(estaLleno).length

  // CSV con lo visible (respeta filtros de país / curso / estado / solo con cupo).
  const filasCsv = vista.flatMap(c => c.cursos.flatMap(cu => cu.salones.map(s => ({ c, cu, s }))))
  const descargarCsv = () => {
    type F = typeof filasCsv[number]
    exportToExcel<F>(filasCsv, [
      { header: 'Campaña', accessor: f => f.c.nombre },
      { header: 'Curso', accessor: f => f.cu.tipo },
      { header: 'Salón', accessor: f => etiquetaSalon(f.s.nombre, f.cu.tipo) },
      { header: 'País', accessor: f => PAIS[f.s.pais || ''] || f.s.pais || '' },
      { header: 'Guía', accessor: f => f.s.guia || '' },
      { header: 'Horario', accessor: f => resumenHorario(f.s.horario) },
      { header: 'Inicio curso', accessor: f => fmtFecha(f.cu.inicio) },
      { header: 'Final curso', accessor: f => fmtFecha(f.cu.finalCurso) },
      { header: 'Cierre ventas', accessor: f => fmtFecha(f.c.finalVenta) },
      { header: 'Inscritos', accessor: f => f.s.ocupados },
      { header: 'Cupo', accessor: f => f.s.cupo },
      { header: 'Disponibles', accessor: f => esActivo(f.s) ? Math.max(0, f.s.cupoDisponible) : 0 },
      { header: 'Lleno', accessor: f => esActivo(f.s) && estaLleno(f.s) ? 'Sí' : 'No' },
      { header: 'Estado', accessor: f => esActivo(f.s) ? 'Activo' : 'Inactivo' },
    ], `cursos-kids_${new Date().toISOString().slice(0, 10)}`)
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={ComercialPermission.CURSOS_KIDS_VER} showDefaultMessage>
        <div className="space-y-5 pb-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AcademicCapIcon className="h-7 w-7 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cursos Kids</h1>
                <p className="text-sm text-gray-500">
                  Campañas de KIDS2026 en matrícula, tal como las muestra KIDS: cursos, salones, país, guía, horario, fechas del programa y cupos. Los salones llenos aparecen en rojo y los inactivos atenuados.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={descargarCsv} disabled={loading || filasCsv.length === 0}
                title="Descarga los salones visibles (con los filtros aplicados)"
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50">
                <ArrowDownTrayIcon className="h-4 w-4" /> Descargar CSV
              </button>
              <button type="button" onClick={load} disabled={loading}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
              </button>
            </div>
          </div>

          {!configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              La integración con KIDS2026 no está configurada en esta plataforma.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              <strong>No se pudo consultar KIDS2026.</strong> {error}
            </div>
          )}

          {!loading && !error && configured && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Campañas en matrícula" valor={campanias.length} />
                <Kpi label="Salones activos" valor={`${activos.length}${todos.length > activos.length ? ` de ${todos.length}` : ''}`} />
                <Kpi label="Cupos disponibles" valor={`${totalDisp} / ${totalCupo}`} />
                <Kpi label="Salones llenos" valor={llenos} rojo={llenos > 0} />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="ck-pais" className="block text-xs text-gray-500 mb-1">País</label>
                  <select id="ck-pais" value={pais} onChange={e => setPais(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]">
                    <option value="">Todos</option>
                    {paises.map(k => <option key={k} value={k}>{PAIS[k] || k}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ck-curso" className="block text-xs text-gray-500 mb-1">Curso</label>
                  <select id="ck-curso" value={curso} onChange={e => setCurso(e.target.value)}
                    className={`border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px] ${curso ? `font-bold ${cursoColorCls(curso)}` : ''}`}>
                    <option value="" className="font-normal text-gray-900">Todos</option>
                    {tiposCurso.map(t => <option key={t} value={t} className={`font-bold ${cursoColorCls(t)}`}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Estado</span>
                  <div className="flex gap-1">
                    {(['TODOS', 'ACTIVO', 'INACTIVO'] as const).map(op => (
                      <button key={op} type="button" onClick={() => setEstado(op)}
                        className={`px-3 py-2 text-sm rounded-lg border ${estado === op ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        {op === 'TODOS' ? 'Todos' : op === 'ACTIVO' ? 'Activos' : 'Inactivos'}
                        {' '}({op === 'TODOS' ? todos.length : op === 'ACTIVO' ? activos.length : todos.length - activos.length})
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                  <input type="checkbox" checked={soloConCupo} onChange={e => setSoloConCupo(e.target.checked)} />
                  Solo con cupo
                </label>
                {consultado && (
                  <span className="ml-auto text-xs text-gray-400 pb-2">
                    Consultado: {new Date(consultado).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            </>
          )}

          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" /><p className="text-sm text-gray-400">Consultando KIDS2026…</p></div>
          ) : !error && configured && campanias.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
              No hay campañas en matrícula en KIDS2026.
            </p>
          ) : (
            vista.map(c => {
              const filas = c.cursos.flatMap(cu => cu.salones.map(s => ({ cu, s })))
              const prog = c.cursos.find(cu => cu.inicio) ?? null
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-base font-semibold text-gray-900">
                      {c.nombre} <span className="ml-1 text-sm font-normal text-gray-500">({filas.length} {filas.length === 1 ? 'salón' : 'salones'})</span>
                    </h2>
                    <span className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Campaña: <strong>{fmtFecha(c.inicio)} → {fmtFecha(c.fin)}</strong></span>
                      {prog && <span>Programa: <strong>{fmtFecha(prog.inicio)} → {fmtFecha(prog.finalCurso)}</strong></span>}
                      {c.finalVenta && <span>Cierre de ventas: <strong className="text-purple-700">{fmtFecha(c.finalVenta)}</strong></span>}
                    </span>
                  </div>
                  {filas.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">Sin salones para los filtros seleccionados.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['Curso', 'Salón', 'País', 'Guía', 'Horario', 'Inicio curso', 'Final curso', 'Cierre ventas', 'Inscritos / Cupo', 'Disponibles', 'Estado'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filas.map(({ cu, s }) => {
                            const activo = esActivo(s)
                            const lleno = activo && estaLleno(s)
                            return (
                              <tr key={s.id} className={`${lleno ? 'bg-red-50' : 'hover:bg-gray-50'} ${activo ? '' : 'opacity-50'}`}>
                                <td className={`px-3 py-2 font-bold ${cursoColorCls(cu.tipo) || 'text-gray-900'}`}>{cu.tipo}</td>
                                <td className={`px-3 py-2 font-semibold whitespace-nowrap ${lleno ? 'text-red-700' : 'text-gray-800'}`}>{etiquetaSalon(s.nombre, cu.tipo)}</td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{PAIS[s.pais || ''] || s.pais || '—'}</td>
                                <td className="px-3 py-2 text-gray-700">{s.guia || <span className="text-gray-400">— sin guía —</span>}</td>
                                <td className="px-3 py-2 text-gray-700">{resumenHorario(s.horario)}</td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtFecha(cu.inicio)}</td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtFecha(cu.finalCurso)}</td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtFecha(c.finalVenta)}</td>
                                <td className={`px-3 py-2 whitespace-nowrap ${lleno ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>{s.ocupados} / {s.cupo}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {!activo
                                    ? <span className="text-gray-400">—</span>
                                    : lleno
                                      ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">LLENO</span>
                                      : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">{s.cupoDisponible}</span>}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                                    {activo ? 'Activo' : 'Inactivo'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}

function Kpi({ label, valor, rojo }: { label: string; valor: string | number; rojo?: boolean }) {
  return (
    <div className={`rounded-xl border shadow-sm px-4 py-3 ${rojo ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
      <p className={`text-2xl font-bold ${rojo ? 'text-red-700' : 'text-gray-900'}`}>{valor}</p>
    </div>
  )
}
