'use client'

/**
 * Panel Advisor › Mis horas y facturas.
 *  - Mis horas: horas del mes por semana y tipo de evento, por corte (Colombia por
 *    quincena; Chile y Ecuador mensual), con los ajustes y su motivo. SOLO HORAS.
 *  - Facturas: subir la factura/boleta de cada corte hasta el plazo (día 20 la 1ra
 *    quincena; día 5 del mes siguiente la 2da quincena y el mes). Verificada = solo lectura.
 * Siempre del advisor de la SESIÓN (lo resuelve el servidor). Planta solo ve horas.
 */

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronLeftIcon, ChevronRightIcon, DocumentArrowUpIcon, EyeIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { api, handleApiError } from '@/hooks/use-api'
import {
  COLUMNAS_TIPO, ESTADO_CORTE, CORTE_LABEL, CONCEPTOS_AJUSTE, fmtH, etiquetaPeriodo, corrPeriodo, type EstadoCorte, type Corte,
} from '@/components/administracion/liquidacion-tipos'

interface CorteAdv {
  programa: 'LGS' | 'KIDS'; corte: Corte; estado: EstadoCorte; requiereFactura: boolean; plazo: string; plazoReenvio: string | null; horas: number
  ajustes: { fecha: string; concepto: string; horas: number; motivo: string; alcance: string; semanaInicio: string | null }[]
  factura: null | { _id: string; nombre: string | null; estado: string; subidoEn: string; comentarioDevolucion: string | null }
}
interface Datos {
  periodo: string; parcial: boolean; semanas: { n: number; inicio: string; fin: string }[]
  advisor: { nombre: string; pais: string | null; tipoContratacion: string }
  liquidaciones: any[]; cortes: CorteAdv[]
}

const fFecha = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}` }

export default function MisHorasPage() {
  const mesActual = new Date().toISOString().slice(0, 7)
  const [periodo, setPeriodo] = useState(mesActual)
  const [tab, setTab] = useState<'horas' | 'facturas'>('horas')
  const [d, setD] = useState<Datos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try { setD(await api.get<Datos>(`/api/postgres/panel-advisor/mis-horas?periodo=${periodo}`)) }
    catch (e: any) { setError(e?.message || 'No se pudo cargar'); setD(null) }
    finally { setLoading(false) }
  }, [periodo])
  useEffect(() => { cargar() }, [cargar])

  const subir = async (c: CorteAdv, file: File) => {
    setSubiendo(`${c.programa}-${c.corte}`)
    try {
      const fd = new FormData()
      fd.set('file', file); fd.set('programa', c.programa); fd.set('periodo', periodo); fd.set('corte', c.corte)
      const res = await fetch('/api/postgres/panel-advisor/mis-horas/factura', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Factura recibida. Administración la revisará.'); cargar()
    } catch (e: any) { handleApiError(e, e?.message || 'No se pudo subir la factura') } finally { setSubiendo(null) }
  }

  const planta = d?.advisor.tipoContratacion === 'PLANTA'
  const tipos = (l: any) => COLUMNAS_TIPO.filter(c => l.porTipo?.[c.k] > 0)

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis horas y facturas</h1>
            <p className="text-sm text-gray-500">{d?.advisor.nombre}{d?.advisor.pais ? ` · ${d.advisor.pais}` : ''} — horas liquidadas por la plataforma{planta ? '' : ' y facturas de cada corte'}.</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPeriodo(p => corrPeriodo(p, -1))} className="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50"><ChevronLeftIcon className="h-4 w-4" /></button>
            <span className="px-3 text-sm font-semibold text-gray-800 min-w-[130px] text-center">{etiquetaPeriodo(periodo)}</span>
            <button type="button" onClick={() => setPeriodo(p => corrPeriodo(p, 1))} disabled={periodo >= mesActual} className="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"><ChevronRightIcon className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          {([['horas', 'Mis horas', ClockIcon], ...(planta ? [] : [['facturas', 'Facturas', DocumentTextIcon]])] as any[]).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-sky-700 text-sky-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>

        {loading ? <p className="p-10 text-center text-sm text-gray-400 italic">Cargando…</p>
          : error ? <p className="p-10 text-center text-sm text-red-600">{error}</p>
          : !d ? null : tab === 'horas' ? (
          <div className="space-y-4">
            {d.parcial && <p className="text-xs text-amber-700">Mes en curso: las horas se actualizan a medida que ocurren las clases.</p>}
            {d.liquidaciones.map((l: any) => (
              <div key={l.programaLiq} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className={`px-4 py-2 text-sm font-semibold text-white ${l.programaLiq === 'KIDS' ? 'bg-fuchsia-700' : 'bg-sky-800'}`}>
                  {l.programaLiq === 'KIDS' ? 'Kids' : 'LGS'} · total del mes <span className="text-lg">{fmtH(l.total)} h</span>
                  {l.cortes.length > 1 && <span className="ml-3 font-normal">({l.cortes.map((c: any) => `${CORTE_LABEL[c.corte as Corte]} ${fmtH(c.horas)} h`).join(' · ')})</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b">
                      <th className="px-3 py-2 text-left">Semana</th>
                      {tipos(l).map(c => <th key={c.k} className="px-2 text-right">{c.l}</th>)}
                      <th className="px-3 text-right text-gray-800">Total</th>
                    </tr></thead>
                    <tbody>
                      {d.semanas.map(s => {
                        const w = l.semanas[s.n - 1]
                        return (
                          <tr key={s.n} className="border-b border-gray-100">
                            <td className="px-3 py-1.5 whitespace-nowrap">Sem {s.n} <span className="text-xs text-gray-400">{fFecha(s.inicio).slice(0, 5)}–{fFecha(s.fin).slice(0, 5)}</span></td>
                            {tipos(l).map(c => <td key={c.k} className="px-2 text-right tabular-nums text-gray-600">{fmtH(w?.porTipo?.[c.k] || 0)}</td>)}
                            <td className="px-3 text-right tabular-nums font-semibold">{fmtH(w?.total || 0)}</td>
                          </tr>
                        )
                      })}
                      <tr className="bg-sky-50 font-semibold text-sky-900">
                        <td className="px-3 py-1.5">Total</td>
                        {tipos(l).map(c => <td key={c.k} className="px-2 text-right tabular-nums">{fmtH(l.porTipo[c.k])}</td>)}
                        <td className="px-3 text-right tabular-nums">{fmtH(l.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 text-xs text-gray-500 flex flex-wrap gap-x-4">
                  {l.sinAsistentes > 0 && <span>{l.sinAsistentes} clases sin asistentes{d.advisor.tipoContratacion === 'POR_HORAS' ? ' (½ h c/u)' : ''}</span>}
                  {l.porConcepto?.FESTIVO > 0 && <span>{fmtH(l.porConcepto.FESTIVO)} h en festivo</span>}
                  {l.noPagadas && (l.noPagadas.canceladas + l.noPagadas.suspendidas + l.noPagadas.noAsistio) > 0 && (
                    <span>no se pagan: {l.noPagadas.canceladas} canceladas · {l.noPagadas.suspendidas} suspendidas · {l.noPagadas.noAsistio} no asistió</span>
                  )}
                </div>
                {d.cortes.filter(c => c.programa === l.programaLiq).flatMap(c => c.ajustes).length > 0 && (
                  <div className="px-4 pb-3 space-y-1">
                    <div className="text-xs font-semibold text-gray-700">Ajustes de Académico</div>
                    {d.cortes.filter(c => c.programa === l.programaLiq).flatMap(c => c.ajustes.map(x => ({ ...x, corte: c.corte }))).map((x, i) => (
                      <div key={i} className="text-xs text-gray-700 border-l-2 border-sky-300 pl-2">
                        <b className={x.horas > 0 ? 'text-emerald-700' : 'text-red-700'}>{x.horas > 0 ? '+' : ''}{x.horas} h</b>{' '}
                        {CONCEPTOS_AJUSTE.find(k => k.v === x.concepto)?.l || x.concepto} · {x.alcance === 'SEMANA' ? `semana del ${x.semanaInicio?.slice(8)}` : CORTE_LABEL[x.corte]} — <i>{x.motivo}</i>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Suba su factura o boleta (PDF o imagen) por cada corte. La fecha debe estar dentro del periodo y las horas deben coincidir con las de la plataforma. Una vez verificada no se puede reemplazar.</p>
            {d.cortes.filter(c => c.requiereFactura).length === 0 && <p className="p-6 text-center text-sm text-gray-500">No hay cortes por facturar en {etiquetaPeriodo(periodo)}.</p>}
            {d.cortes.filter(c => c.requiereFactura).map(c => {
              const cerrado = c.estado === 'VERIFICADO' || c.estado === 'PAGADO'
              const vencido = c.estado === 'SIN_FACTURA'
              const plazo = c.plazoReenvio && c.plazoReenvio > c.plazo ? c.plazoReenvio : c.plazo
              const k = `${c.programa}-${c.corte}`
              return (
                <div key={k} className="rounded-lg border border-gray-200 bg-white p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-[180px]">
                    <div className="text-sm font-semibold text-gray-900">{c.programa === 'KIDS' ? 'Kids' : 'LGS'} · {c.corte === 'MES' ? etiquetaPeriodo(periodo) : `${CORTE_LABEL[c.corte]} ${etiquetaPeriodo(periodo)}`}</div>
                    <div className="text-xs text-gray-500">{fmtH(c.horas)} h · plazo {fFecha(plazo)}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ESTADO_CORTE[c.estado].cls}`}>{ESTADO_CORTE[c.estado].l}</span>
                  {c.factura && (
                    <a href={`/api/postgres/administracion/factura/${c.factura._id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline">
                      <EyeIcon className="h-3.5 w-3.5" /> {c.factura.nombre || 'Ver factura'} ({fFecha(c.factura.subidoEn)})
                    </a>
                  )}
                  {c.estado === 'DEVUELTA' && c.factura?.comentarioDevolucion && (
                    <div className="basis-full text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">Administración la devolvió: “{c.factura.comentarioDevolucion}”. Suba la corregida antes del {fFecha(plazo)}.</div>
                  )}
                  {vencido && <div className="basis-full text-xs text-red-700">Venció el plazo para subir la factura. Comuníquese con Administración.</div>}
                  {!cerrado && !vencido && (
                    <label className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 rounded-md cursor-pointer hover:bg-sky-800 ${subiendo === k ? 'opacity-50 pointer-events-none' : ''}`}>
                      <DocumentArrowUpIcon className="h-4 w-4" /> {subiendo === k ? 'Subiendo…' : c.factura ? 'Reemplazar factura' : 'Subir factura'}
                      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) subir(c, f); e.target.value = '' }} />
                    </label>
                  )}
                  {cerrado && <span className="ml-auto text-xs text-emerald-700 font-semibold">Verificada — lista para pago</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
