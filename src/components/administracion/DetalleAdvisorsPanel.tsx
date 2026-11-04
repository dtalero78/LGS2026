'use client'

/**
 * Gestión Advisors › Detalle Advisors: horas por semana (lunes–domingo) y total del
 * mes por tipo de evento, con subtotales por plataforma — equivalente a las hojas
 * DETAIL-CL / DETAIL-COL / DETAIL-ECU. Selectores tipo hoja (Todos · Chile ·
 * Colombia · Ecuador · Kids), buscador de advisor y CSV de lo visible.
 * Clic en un advisor → sus eventos del mes. Valores solo con VER_COMPENSACION.
 */

import { useMemo, useState } from 'react'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { exportToExcel } from '@/lib/export-excel'
import { api, handleApiError } from '@/hooks/use-api'
import {
  type AdvisorLiq, type Liquidacion, type Pais, PAISES, COLUMNAS_TIPO, MONEDA, CORTE, TIPO_LABEL,
  fmtH, fmtMoneda, etiquetaPeriodo,
} from './liquidacion-tipos'

type Hoja = 'Todos' | Pais | 'Kids'
const TIPO_CLS: Record<string, string> = {
  POR_HORAS: 'bg-sky-100 text-sky-800', SEMIPLANTA: 'bg-violet-100 text-violet-800', PLANTA: 'bg-emerald-100 text-emerald-800',
}

export default function DetalleAdvisorsPanel({ liq, loading, puedeExportar }: { liq: Liquidacion | null; loading: boolean; puedeExportar: boolean }) {
  const [hoja, setHoja] = useState<Hoja>('Todos')
  const [buscar, setBuscar] = useState('')
  const [verSemanas, setVerSemanas] = useState(true)
  const [detalle, setDetalle] = useState<AdvisorLiq | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  const visibles = useMemo(() => {
    if (!liq) return []
    const q = buscar.trim().toLowerCase()
    return liq.advisors.filter(a => (hoja === 'Todos' || a.pais === hoja) && (!q || a.nombre.toLowerCase().includes(q)))
  }, [liq, hoja, buscar])

  const verValores = !!liq?.verValores
  const semanas = liq?.semanas || []
  // Columnas de tipo con datos (para no ensanchar con columnas vacías)
  const tiposConDatos = COLUMNAS_TIPO.filter(c => visibles.some(a => a.porTipo[c.k] > 0))

  const abrir = async (a: AdvisorLiq) => {
    setDetalle(a); setCargandoDet(true)
    try {
      const d = await api.get<Liquidacion>(`/api/postgres/administracion/liquidacion?periodo=${liq!.periodo}&advisorId=${encodeURIComponent(a.advisorId)}`)
      if (d.advisors[0]) setDetalle(d.advisors[0])
    } catch (e) { handleApiError(e, 'No se pudieron cargar los eventos') } finally { setCargandoDet(false) }
  }

  const exportar = () => {
    if (!liq) return
    exportToExcel(visibles, [
      { header: 'País', accessor: a => a.pais },
      { header: 'Advisor', accessor: a => a.nombre },
      { header: 'Tipo', accessor: a => TIPO_LABEL[a.tipoContratacion] || a.tipoContratacion },
      { header: 'Categoría', accessor: a => a.categoriaTarifa },
      ...semanas.map(s => ({ header: `Semana ${s.n} (${s.inicio.slice(8)}-${s.fin.slice(8)})`, accessor: (a: AdvisorLiq) => a.semanas[s.n - 1]?.total || 0 })),
      { header: '1ra quincena', accessor: a => a.quincenas.q1 },
      { header: '2da quincena', accessor: a => a.quincenas.q2 },
      ...COLUMNAS_TIPO.map(c => ({ header: c.l, accessor: (a: AdvisorLiq) => a.porTipo[c.k] })),
      { header: 'Sin asistentes (eventos)', accessor: a => a.sinAsistentes },
      { header: 'Horas normal', accessor: a => a.porConcepto.NORMAL },
      { header: 'Horas festivo', accessor: a => a.porConcepto.FESTIVO },
      { header: 'Horas exam. intern.', accessor: a => a.porConcepto.EXAM_INTERN },
      { header: 'Total horas', accessor: a => a.total },
      { header: 'Horas Chile', accessor: a => a.reparto.Chile },
      { header: 'Horas Colombia', accessor: a => a.reparto.Colombia },
      { header: 'Horas Ecuador', accessor: a => a.reparto.Ecuador },
      ...(verValores ? [
        { header: 'Moneda', accessor: (a: AdvisorLiq) => a.valor?.moneda },
        { header: 'Valor total', accessor: (a: AdvisorLiq) => a.valor?.total },
      ] : []),
      { header: 'Canceladas', accessor: a => a.noPagadas.canceladas },
      { header: 'Suspendidas', accessor: a => a.noPagadas.suspendidas },
      { header: 'No asistió', accessor: a => a.noPagadas.noAsistio },
    ], `detalle-advisors-${liq.periodo}${hoja === 'Todos' ? '' : '-' + hoja.toLowerCase()}`)
  }

  const secciones: Pais[] = hoja === 'Todos' ? PAISES : PAISES.includes(hoja as Pais) ? [hoja as Pais] : []

  const fila = (a: AdvisorLiq) => (
    <tr key={a.advisorId} onClick={() => abrir(a)} className="border-b border-gray-100 hover:bg-sky-50/60 cursor-pointer">
      <td className="sticky left-0 bg-white px-3 py-1.5 min-w-[220px]">
        <div className={`font-medium ${a.activo ? 'text-gray-900' : 'text-red-700'}`}>{a.nombre}</div>
        <div className="flex gap-1 mt-0.5">
          <span className={`px-1.5 rounded text-[10px] font-semibold ${TIPO_CLS[a.tipoContratacion] || ''}`}>{TIPO_LABEL[a.tipoContratacion]}</span>
          {a.categoriaTarifa !== 'ESTANDAR' && <span className="px-1.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">{a.categoriaTarifa}</span>}
        </div>
      </td>
      {verSemanas && semanas.map(s => <td key={s.n} className="text-right tabular-nums px-2 text-gray-700">{fmtH(a.semanas[s.n - 1]?.total || 0)}</td>)}
      {a.pais === 'Colombia' && <><td className="text-right tabular-nums px-2 bg-sky-50/50">{fmtH(a.quincenas.q1)}</td><td className="text-right tabular-nums px-2 bg-sky-50/50">{fmtH(a.quincenas.q2)}</td></>}
      {tiposConDatos.map(c => <td key={c.k} className="text-right tabular-nums px-2 text-gray-600">{fmtH(a.porTipo[c.k])}</td>)}
      <td className="text-right tabular-nums px-2 text-orange-600" title="Eventos conducidos sin asistentes (½ h para por horas)">{a.sinAsistentes || '—'}</td>
      <td className="text-right tabular-nums px-2 text-rose-600">{fmtH(a.porConcepto.FESTIVO)}</td>
      <td className="text-right tabular-nums px-2 font-bold text-gray-900 bg-gray-50">{fmtH(a.total)}</td>
      {verValores && (
        <td className="text-right tabular-nums px-3 font-semibold text-sky-900 whitespace-nowrap">
          {a.valor ? fmtMoneda(a.valor.total, a.valor.moneda) : '—'}
          {a.valor?.faltanTarifas.length ? <div className="text-[10px] text-red-600 font-normal">falta tarifa {a.valor.faltanTarifas.join(', ')}</div> : null}
          {a.tipoContratacion !== 'POR_HORAS' && a.valor && !a.valor.fijo ? <div className="text-[10px] text-amber-600 font-normal">sin valor fijo</div> : null}
        </td>
      )}
    </tr>
  )

  const subtotal = (lista: AdvisorLiq[], etiqueta: string, pais: Pais | null, cls: string) => {
    const s = (f: (a: AdvisorLiq) => number) => lista.reduce((t, a) => t + f(a), 0)
    const moneda = pais ? MONEDA[pais] : null
    return (
      <tr className={cls}>
        <td className="sticky left-0 px-3 py-1.5 font-semibold bg-inherit">{etiqueta} <span className="font-normal text-gray-500">· {lista.length} advisors</span></td>
        {verSemanas && semanas.map(w => <td key={w.n} className="text-right tabular-nums px-2 font-semibold">{fmtH(s(a => a.semanas[w.n - 1]?.total || 0))}</td>)}
        {pais === 'Colombia' && <><td className="text-right tabular-nums px-2 font-semibold">{fmtH(s(a => a.quincenas.q1))}</td><td className="text-right tabular-nums px-2 font-semibold">{fmtH(s(a => a.quincenas.q2))}</td></>}
        {tiposConDatos.map(c => <td key={c.k} className="text-right tabular-nums px-2 font-semibold">{fmtH(s(a => a.porTipo[c.k]))}</td>)}
        <td className="text-right tabular-nums px-2 font-semibold">{s(a => a.sinAsistentes) || '—'}</td>
        <td className="text-right tabular-nums px-2 font-semibold">{fmtH(s(a => a.porConcepto.FESTIVO))}</td>
        <td className="text-right tabular-nums px-2 font-bold">{fmtH(s(a => a.total))}</td>
        {verValores && <td className="text-right tabular-nums px-3 font-bold whitespace-nowrap">{moneda ? fmtMoneda(s(a => a.valor?.total || 0), moneda) : '—'}</td>}
      </tr>
    )
  }

  const encabezado = (pais: Pais) => (
    <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50 border-b">
      <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left">Advisor</th>
      {verSemanas && semanas.map(s => <th key={s.n} className="px-2 text-right font-semibold" title={`${s.inicio} a ${s.fin}`}>Sem {s.n}<div className="normal-case font-normal text-[10px]">{s.inicio.slice(8)}–{s.fin.slice(8)}</div></th>)}
      {pais === 'Colombia' && <><th className="px-2 text-right bg-sky-50">1ra Q</th><th className="px-2 text-right bg-sky-50">2da Q</th></>}
      {tiposConDatos.map(c => <th key={c.k} className="px-2 text-right font-semibold">{c.l}</th>)}
      <th className="px-2 text-right text-orange-600" title="Eventos sin asistentes">Sin asist.</th>
      <th className="px-2 text-right text-rose-600">Festivo h</th>
      <th className="px-2 text-right text-gray-800 bg-gray-100">Total h</th>
      {verValores && <th className="px-3 text-right text-sky-900">Valor ({MONEDA[pais]})</th>}
    </tr>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['Todos', ...PAISES, 'Kids'] as Hoja[]).map(h => (
          <button key={h} type="button" onClick={() => setHoja(h)} disabled={h === 'Kids'}
            title={h === 'Kids' ? 'Kids se integra en la Fase 3 (horas desde KIDS2026)' : undefined}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md border-b-2 ${hoja === h ? 'border-sky-700 text-sky-800 bg-sky-50' : 'border-transparent text-gray-500 hover:text-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}>
            {h === 'Todos' ? 'Todos' : h === 'Kids' ? 'Kids · pronto' : `${h} · ${MONEDA[h as Pais]}`}
          </button>
        ))}
        <label className="ml-3 inline-flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={verSemanas} onChange={e => setVerSemanas(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" /> Semanas
        </label>
        <div className="relative ml-auto">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-2 top-2 text-gray-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar advisor…" className="pl-7 pr-2 py-1.5 text-sm rounded-md border border-gray-300 w-56" />
        </div>
        {puedeExportar && (
          <button type="button" onClick={exportar} disabled={!visibles.length}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-white border border-sky-300 rounded-md hover:bg-sky-50 disabled:opacity-40">
            <ArrowDownTrayIcon className="h-4 w-4" /> CSV
          </button>
        )}
      </div>

      {loading && !liq ? (
        <p className="p-10 text-center text-sm text-gray-400 italic">Calculando horas…</p>
      ) : !liq || !secciones.length ? null : (
        <div className="overflow-auto max-h-[70vh] rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            {secciones.map(pais => {
              const lista = visibles.filter(a => a.pais === pais)
              if (!lista.length) return null
              return (
                <tbody key={pais} className="border-b-4 border-gray-200">
                  <tr><td colSpan={99} className="sticky left-0 bg-sky-800 text-white px-3 py-1.5 text-xs font-bold tracking-wide">
                    {pais.toUpperCase()} · {MONEDA[pais]} · corte {CORTE[pais]} · {etiquetaPeriodo(liq.periodo)}{liq.parcial ? ' (parcial)' : ''}
                  </td></tr>
                  {encabezado(pais)}
                  {lista.map(fila)}
                  {subtotal(lista, `Subtotal ${pais}`, pais, 'bg-sky-50 border-t border-sky-200 text-sky-900')}
                </tbody>
              )
            })}
            {hoja === 'Todos' && visibles.length > 0 && (
              <tbody>{subtotal(visibles, 'GRAN TOTAL (horas)', null, 'bg-gray-800 text-white')}</tbody>
            )}
          </table>
        </div>
      )}
      {liq && !visibles.length && !loading && <p className="p-8 text-center text-sm text-gray-500">Sin horas para este filtro.</p>}

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetalle(null)}>
          <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b px-5 py-3">
              <div>
                <div className="text-base font-semibold text-gray-900">{detalle.nombre}</div>
                <div className="text-xs text-gray-500">
                  {detalle.pais} · {TIPO_LABEL[detalle.tipoContratacion]} · {detalle.categoriaTarifa} · {etiquetaPeriodo(liq!.periodo)} —
                  <b className="text-gray-800"> {fmtH(detalle.total)} h</b>
                  {verValores && detalle.valor && <> · <b className="text-sky-900">{fmtMoneda(detalle.valor.total, detalle.valor.moneda)}</b></>}
                  {' '}· no pagadas: {detalle.noPagadas.canceladas} canceladas, {detalle.noPagadas.suspendidas} suspendidas, {detalle.noPagadas.noAsistio} no asistió
                </div>
              </div>
              <button type="button" onClick={() => setDetalle(null)} className="p-1 text-gray-500 hover:text-gray-800"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto">
              {cargandoDet ? <p className="p-8 text-center text-sm text-gray-400 italic">Cargando eventos…</p> : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <tr><th className="px-3 py-2 text-left">Fecha</th><th className="text-left">Hora</th><th className="text-left">Sem</th><th className="text-left">Tipo</th><th className="text-left">Evento</th>
                      <th className="text-right">Insc.</th><th className="text-right">Asist.</th><th className="text-left pl-3">Concepto</th><th className="text-right">Horas</th><th className="text-left pl-3 pr-3">Se carga a</th></tr>
                  </thead>
                  <tbody>
                    {(detalle.eventos || []).map(e => (
                      <tr key={e.eventoId} className={`border-b border-gray-100 ${e.sinAsistentes ? 'bg-orange-50/60' : ''}`}>
                        <td className="px-3 py-1 whitespace-nowrap">{e.fecha.slice(8)}/{e.fecha.slice(5, 7)}</td>
                        <td>{e.hora || ''}</td><td>{e.semana}</td>
                        <td className="capitalize">{e.tipo}{e.compartido && <span title="Evento compartido (varios niveles, 1 hora)"> 🔗</span>}</td>
                        <td className="max-w-[260px] truncate" title={e.titulo}>{e.titulo}</td>
                        <td className="text-right tabular-nums">{e.inscritos}</td>
                        <td className={`text-right tabular-nums ${e.asistentes ? '' : 'text-orange-600 font-semibold'}`}>{e.asistentes}</td>
                        <td className="pl-3">{e.concepto === 'FESTIVO' ? <span className="text-rose-600" title={e.festivo || ''}>Festivo</span> : e.concepto === 'EXAM_INTERN' ? 'Exam. intern.' : 'Normal'}</td>
                        <td className="text-right tabular-nums font-semibold">{e.horas}</td>
                        <td className="pl-3 pr-3 whitespace-nowrap text-gray-500">
                          {PAISES.filter(p => e.reparto[p] > 0).map(p => `${p.slice(0, 2).toUpperCase()} ${Math.round(e.reparto[p] * 100)}%`).join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
