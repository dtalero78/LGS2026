'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import KidsCursoTexto, { cursoColorCls } from '@/components/comercial/KidsCursoTexto'
import { PermissionGuard } from '@/components/permissions'
import { ComercialPermission } from '@/types/permissions'

interface Slot { tipo: string; diaSemana: number; horaLocal: string; duracionMin: number }
interface Salon {
  id: string; nombre: string; pais?: string | null
  cupo: number; ocupados: number; cupoDisponible: number; lleno?: boolean
  guia: string | null; horario: Slot[]
}
interface Curso { tipo: string; salones: Salon[] }
interface Campania { id: string; nombre: string; inicio: string; fin: string; cursos: Curso[] }

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
// KIDS agrupa los salones por país de forma binaria: "CL" = Chile; "CO" = grupo general
// (Colombia, Ecuador, Perú y demás países).
const PAIS: Record<string, string> = { CL: 'Chile', CO: 'Colombia / otros países' }
const fmtFecha = (v: string) => {
  const [y, m, d] = String(v || '').slice(0, 10).split('-')
  return y ? `${d}/${m}/${y}` : '—'
}
const horario = (s: Salon) =>
  (s.horario || [])
    .slice()
    .sort((a, b) => a.diaSemana - b.diaSemana || a.horaLocal.localeCompare(b.horaLocal))
    .map(h => `${DIAS[h.diaSemana] ?? h.diaSemana} ${h.horaLocal}${h.duracionMin ? ` (${h.duracionMin} min)` : ''}`)
    .join(' · ')
// "lleno" lo envía KIDS; si aún no lo envía, se deduce del cupo.
const estaLleno = (s: Salon) => s.lleno === true || s.ocupados >= s.cupo

export default function CursosKidsPage() {
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [consultado, setConsultado] = useState<string | null>(null)
  const [pais, setPais] = useState('')
  const [curso, setCurso] = useState('')
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

  // Filas planas por salón (campaña → curso → salón) con los filtros aplicados.
  const vista = useMemo(() => campanias.map(c => ({
    ...c,
    cursos: c.cursos
      .filter(cu => !curso || cu.tipo === curso)
      .map(cu => ({ ...cu, salones: cu.salones.filter(s => (!pais || s.pais === pais) && (!soloConCupo || !estaLleno(s))) }))
      .filter(cu => cu.salones.length > 0),
  })), [campanias, pais, curso, soloConCupo])

  const tiposCurso = Array.from(new Set(campanias.flatMap(c => c.cursos.map(cu => cu.tipo)))).sort()
  const todos = campanias.flatMap(c => c.cursos.flatMap(cu => cu.salones))
  const totalCupo = todos.reduce((a, s) => a + s.cupo, 0)
  const totalDisp = todos.reduce((a, s) => a + Math.max(0, s.cupoDisponible), 0)
  const llenos = todos.filter(estaLleno).length

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
                  Campañas de KIDS2026 en matrícula: cursos, país, horario y cupos disponibles. Los salones llenos aparecen en rojo.
                </p>
              </div>
            </div>
            <button type="button" onClick={load} disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
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
                <Kpi label="Salones" valor={todos.length} />
                <Kpi label="Cupos disponibles" valor={`${totalDisp} / ${totalCupo}`} />
                <Kpi label="Salones llenos" valor={llenos} rojo={llenos > 0} />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="ck-pais" className="block text-xs text-gray-500 mb-1">País</label>
                  <select id="ck-pais" value={pais} onChange={e => setPais(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]">
                    <option value="">Todos</option>
                    {Object.entries(PAIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ck-curso" className="block text-xs text-gray-500 mb-1">Curso</label>
                  <select id="ck-curso" value={curso} onChange={e => setCurso(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]">
                    <option value="">Todos</option>
                    {tiposCurso.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
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
            vista.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{c.nombre}</h2>
                  <span className="text-xs text-gray-500">{fmtFecha(c.inicio)} → {fmtFecha(c.fin)}</span>
                </div>
                {c.cursos.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">Sin salones para los filtros seleccionados.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Curso', 'Salón', 'País', 'Horario', 'Guía', 'Inscritos / Cupo', 'Disponibles'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {c.cursos.flatMap(cu => cu.salones.map(s => {
                          const lleno = estaLleno(s)
                          return (
                            <tr key={s.id} className={lleno ? 'bg-red-50' : 'hover:bg-gray-50'}>
                              <td className={`px-3 py-2 font-bold ${cursoColorCls(cu.tipo) || 'text-gray-900'}`}>{cu.tipo}</td>
                              <td className={`px-3 py-2 ${lleno ? 'text-red-700 font-medium' : 'text-gray-800'}`}><KidsCursoTexto texto={s.nombre} /></td>
                              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{PAIS[s.pais || ''] || s.pais || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{horario(s) || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{s.guia || '—'}</td>
                              <td className={`px-3 py-2 whitespace-nowrap ${lleno ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>{s.ocupados} / {s.cupo}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {lleno
                                  ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">LLENO</span>
                                  : <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">{s.cupoDisponible}</span>}
                              </td>
                            </tr>
                          )
                        }))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
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
