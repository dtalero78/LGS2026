'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDownTrayIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { exportToExcel } from '@/lib/export-excel'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { InformesPermission } from '@/types/permissions'

interface Row {
  studentId: string
  nombre: string
  numeroId: string
  plataforma: string | null
  contrato: string | null
  nivelActual: string | null
  stepActual: string | null
  nivel: 'beginner' | 'practical' | 'functional'
  vecesEstudiante: number
  vecesAdmin: number
  primera: string
  ultima: string
  ultimoAdmin: string | null
}
interface Data {
  rows: Row[]
  total: number
  resumen: { nivel: Row['nivel']; estudiantes: number; porEstudiante: number; porAdmin: number }[]
  plataformas: string[]
}

const CERT: Record<Row['nivel'], { label: string; cls: string; card: string }> = {
  beginner:   { label: 'Beginner',   cls: 'bg-yellow-100 text-yellow-900', card: 'border-yellow-300' },
  practical:  { label: 'Practical',  cls: 'bg-red-100 text-red-800',       card: 'border-red-300' },
  functional: { label: 'Functional', cls: 'bg-blue-100 text-blue-800',     card: 'border-blue-300' },
}
const fmt = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })

export default function CertificadosInformePage() {
  const [nivel, setNivel] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [origen, setOrigen] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (f: { nivel: string; plataforma: string; origen: string; startDate: string; endDate: string }) => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams()
      Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v) })
      const res = await fetch(`/api/postgres/reports/academica/certificados?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar datos')
      setData(json)
    } catch (e: any) { setError(e.message || 'Error inesperado') }
    finally { setLoading(false) }
  }, [])

  // Volumen pequeño (una fila por estudiante y nivel): se consulta al abrir y al cambiar filtros.
  useEffect(() => { fetchData({ nivel, plataforma, origen, startDate, endDate }) }, [fetchData, nivel, plataforma, origen, startDate, endDate])

  const limpiar = () => { setNivel(''); setPlataforma(''); setOrigen(''); setStartDate(''); setEndDate('') }

  const handleCSV = () => {
    if (!data?.rows.length) return
    exportToExcel(data.rows, [
      { header: 'Estudiante', accessor: r => r.nombre },
      { header: 'Documento', accessor: r => r.numeroId },
      { header: 'Plataforma', accessor: r => r.plataforma ?? '' },
      { header: 'Contrato', accessor: r => r.contrato ?? '' },
      { header: 'Nivel actual', accessor: r => [r.nivelActual, r.stepActual].filter(Boolean).join(' · ') },
      { header: 'Certificado', accessor: r => CERT[r.nivel]?.label ?? r.nivel },
      { header: 'Veces por estudiante', accessor: r => r.vecesEstudiante },
      { header: 'Veces por admin', accessor: r => r.vecesAdmin },
      { header: 'Total', accessor: r => r.vecesEstudiante + r.vecesAdmin },
      { header: 'Primera generación', accessor: r => fmt(r.primera) },
      { header: 'Última generación', accessor: r => fmt(r.ultima) },
      { header: 'Último admin', accessor: r => r.ultimoAdmin ?? '' },
    ], `certificados-generados${nivel ? '_' + nivel : ''}${plataforma ? '_' + plataforma : ''}${startDate ? '_' + startDate : ''}`)
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={InformesPermission.ACAD_CERTIFICADOS} showDefaultMessage>
        <div className="space-y-5 pb-10">
          <div className="flex items-center gap-3">
            <AcademicCapIcon className="h-7 w-7 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Certificados generados</h1>
              <p className="text-sm text-gray-500">
                Certificados de nivel (Beginner, Practical, Functional) y cuántas veces los generó el estudiante y el personal administrativo.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="ce-plat" className="block text-xs text-gray-500 mb-1">Plataforma</label>
                <select id="ce-plat" value={plataforma} onChange={e => setPlataforma(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]">
                  <option value="">Todas</option>
                  {(data?.plataformas ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ce-nivel" className="block text-xs text-gray-500 mb-1">Nivel del certificado</label>
                <select id="ce-nivel" value={nivel} onChange={e => setNivel(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]">
                  <option value="">Todos</option>
                  {Object.entries(CERT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ce-origen" className="block text-xs text-gray-500 mb-1">Generado por</label>
                <select id="ce-origen" value={origen} onChange={e => setOrigen(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]">
                  <option value="">Todos</option>
                  <option value="ESTUDIANTE">Estudiante</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="ce-start" className="block text-xs text-gray-500 mb-1">Desde</label>
                <input id="ce-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ce-end" className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input id="ce-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 ml-auto flex-wrap">
                <button type="button" onClick={limpiar} disabled={loading}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Limpiar</button>
                <PermissionGuard permission={InformesPermission.ACAD_CERTIFICADOS_EXP}>
                  <button type="button" onClick={handleCSV} disabled={loading || !data?.rows.length}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <ArrowDownTrayIcon className="h-4 w-4" /> Descargar CSV
                  </button>
                </PermissionGuard>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Las fechas filtran por fecha de generación (hora Colombia). Las generaciones por admin se registran desde el 05/10/2026;
              las del estudiante, desde el 23/09/2026.
            </p>
          </div>

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(data?.resumen ?? []).map(r => (
              <div key={r.nivel} className={`bg-white rounded-xl border-2 ${CERT[r.nivel].card} shadow-sm px-5 py-3`}>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{CERT[r.nivel].label}</p>
                <p className="text-3xl font-bold text-gray-900">{r.estudiantes.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500">
                  estudiantes · {r.porEstudiante} por estudiante · {r.porAdmin} por admin
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Detalle</h3>
              <p className="text-xs text-gray-400">{(data?.total ?? 0).toLocaleString()} filas (estudiante + nivel)</p>
            </div>
            {loading ? (
              <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" /><p className="text-sm text-gray-400">Cargando…</p></div>
            ) : !data?.rows.length ? (
              <p className="p-8 text-center text-sm text-gray-400">Sin certificados para los filtros seleccionados.</p>
            ) : (
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {['#', 'Estudiante', 'Documento', 'Plataforma', 'Nivel actual', 'Certificado', 'Por estudiante', 'Por admin', 'Última generación', 'Último admin'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rows.map((r, i) => (
                      <tr key={`${r.studentId}-${r.nivel}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <a href={`/student/${r.studentId}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">{r.nombre || '—'}</a>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.numeroId}</td>
                        <td className="px-3 py-2 text-gray-700">{r.plataforma ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{[r.nivelActual, r.stepActual].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${CERT[r.nivel]?.cls ?? ''}`}>{CERT[r.nivel]?.label ?? r.nivel}</span></td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-800">{r.vecesEstudiante}</td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-800">{r.vecesAdmin}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap" title={`Primera: ${fmt(r.primera)}`}>{fmt(r.ultima)}</td>
                        <td className="px-3 py-2 text-gray-600">{r.ultimoAdmin ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
