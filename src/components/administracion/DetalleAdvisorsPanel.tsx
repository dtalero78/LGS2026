'use client'

/**
 * Gestión Advisors › Detalle Advisors: horas por semana (lunes–domingo) y total del
 * mes por tipo de evento, con subtotales por plataforma — equivalente a las hojas
 * DETAIL-CL / DETAIL-COL / DETAIL-ECU. Selectores tipo hoja (Todos · Chile ·
 * Colombia · Ecuador · Kids), buscador de advisor y CSV de lo visible.
 * Clic en un advisor → sus eventos del mes. Valores solo con VER_COMPENSACION.
 */

import { useMemo, useState } from 'react'
import CorteGestion, { type PermisosCorte } from './CorteGestion'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { exportToExcel } from '@/lib/export-excel'
import { api, handleApiError } from '@/hooks/use-api'
import {
  type AdvisorLiq, type Liquidacion, type Pais, type CorteInfo, PAISES, COLUMNAS_TIPO, MONEDA, CORTE, TIPO_LABEL, ESTADO_CORTE, CORTE_LABEL, claveCorte,
  fmtH, fmtMoneda, etiquetaPeriodo,
} from './liquidacion-tipos'

type Hoja = 'Todos' | Pais | 'Kids'
const TIPO_CLS: Record<string, string> = {
  POR_HORAS: 'bg-sky-100 text-sky-800', SEMIPLANTA: 'bg-violet-100 text-violet-800', PLANTA: 'bg-emerald-100 text-emerald-800',
}

export default function DetalleAdvisorsPanel({ liq, cortes, loading, puedeExportar, permisos, onCambio }: {
  liq: Liquidacion | null; cortes: CorteInfo[]; loading: boolean; puedeExportar: boolean; permisos: PermisosCorte; onCambio: () => void
}) {
  const [pestana, setPestana] = useState<'corte' | 'eventos' | 'historial'>('corte')
  const [historial, setHistorial] = useState<any[] | null>(null)
  const cortesDe = (a: AdvisorLiq) => (a.cortes || []).map(c => cortes.find(x => x.advisorId === a.advisorId && x.programa === a.programaLiq && x.corte === c.corte)).filter(Boolean) as CorteInfo[]
  const verHistorial = async (a: AdvisorLiq) => {
    setPestana('historial'); setHistorial(null)
    try { const d = await api.get<{ log: any[] }>(`/api/postgres/administracion/log?advisorId=${encodeURIComponent(a.advisorId)}&periodo=${liq!.periodo}`); setHistorial(d.log) }
    catch (e) { handleApiError(e, 'No se pudo cargar el historial'); setHistorial([]) }
  }
  const [hoja, setHoja] = useState<Hoja>('Todos')
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState('')
  const [verSemanas, setVerSemanas] = useState(true)
  const [detalle, setDetalle] = useState<AdvisorLiq | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  // Hojas de país = advisors LGS de ese país; hoja Kids = guías (todas las plataformas);
  // Todos = las secciones LGS por país + las de Kids.
  const visibles = useMemo(() => {
    if (!liq) return []
    const q = buscar.trim().toLowerCase()
    return liq.advisors.filter(a =>
      (hoja === 'Todos' || (hoja === 'Kids' ? a.programaLiq === 'KIDS' : a.programaLiq === 'LGS' && a.pais === hoja)) &&
      (!tipo || a.tipoContratacion === tipo) &&
      (!q || a.nombre.toLowerCase().includes(q)))
  }, [liq, hoja, buscar, tipo])

  const verValores = !!liq?.verValores
  const semanas = liq?.semanas || []
  // Columnas de tipo con datos (para no ensanchar con columnas vacías)
  const tiposConDatos = COLUMNAS_TIPO.filter(c => visibles.some(a => a.porTipo[c.k] > 0))

  const abrir = async (a: AdvisorLiq) => {
    setDetalle(a); setCargandoDet(true); setPestana('corte')
    try {
      const d = await api.get<Liquidacion>(`/api/postgres/administracion/liquidacion?periodo=${liq!.periodo}&advisorId=${encodeURIComponent(a.advisorId)}`)
      const mismo = d.advisors.find(x => x.programaLiq === a.programaLiq)
      if (mismo) setDetalle(mismo)
    } catch (e) { handleApiError(e, 'No se pudieron cargar los eventos') } finally { setCargandoDet(false) }
  }

  const exportar = () => {
    if (!liq) return
    exportToExcel(visibles, [
      { header: 'Programa', accessor: a => a.programaLiq },
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
    ], `detalle-advisors-${liq.periodo}${hoja === 'Todos' ? '' : '-' + hoja.toLowerCase()}${tipo ? '-' + tipo.toLowerCase() : ''}`)
  }

  const secciones: { programa: 'LGS' | 'KIDS'; pais: Pais }[] = [
    ...(hoja === 'Todos' || PAISES.includes(hoja as Pais) ? PAISES.filter(p => hoja === 'Todos' || p === hoja).map(p => ({ programa: 'LGS' as const, pais: p })) : []),
    ...(hoja === 'Todos' || hoja === 'Kids' ? PAISES.map(p => ({ programa: 'KIDS' as const, pais: p })) : []),
  ]

  const fila = (a: AdvisorLiq) => (
    <tr key={`${a.advisorId}|${a.programaLiq}`} onClick={() => abrir(a)} className="border-b border-gray-100 hover:bg-sky-50/60 cursor-pointer">
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
      <td className="px-3 whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          {cortesDe(a).map(c => (
            <span key={c.corte} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ESTADO_CORTE[c.estado].cls}`}
              title={c.factura?.inconsistencias.length ? c.factura.inconsistencias.join(' · ') : undefined}>
              {cortesDe(a).length > 1 && <span className="opacity-70">{CORTE_LABEL[c.corte]}</span>}
              {ESTADO_CORTE[c.estado].l}{c.horasOk ? ' · ✓h' : ''}{c.factura?.inconsistencias.length ? ' ⚠' : ''}
            </span>
          ))}
        </div>
      </td>
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
        <td className="px-3 text-[11px] whitespace-nowrap">{(() => { const cs = lista.flatMap(cortesDe).filter(c => c.estado !== 'SIN_HORAS'); const v = cs.filter(c => c.estado === 'VERIFICADO' || c.estado === 'PAGADO').length; return cs.length ? `${v}/${cs.length} verificados` : '' })()}</td>
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
      <th className="px-3 text-left">Estado</th>
    </tr>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['Todos', ...PAISES, 'Kids'] as Hoja[]).map(h => (
          <button key={h} type="button" onClick={() => setHoja(h)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md border-b-2 ${hoja === h ? (h === 'Kids' ? 'border-fuchsia-600 text-fuchsia-800 bg-fuchsia-50' : 'border-sky-700 text-sky-800 bg-sky-50') : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {h === 'Todos' ? 'Todos' : h === 'Kids' ? 'Kids · guías' : `${h} · ${MONEDA[h as Pais]}`}
          </button>
        ))}
        <select value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo de contratación"
          className="ml-3 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-gray-600">
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

      {liq && (hoja === 'Todos' || hoja === 'Kids') && (!liq.kids.ok || liq.kids.sinGuia > 0 || liq.kids.guiaSinEnlace.length > 0) && (
        <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-xs text-fuchsia-900 space-y-0.5">
          {!liq.kids.ok && <div>• KIDS no respondió ({liq.kids.error}); las horas de guías no están incluidas.</div>}
          {liq.kids.sinGuia > 0 && <div>• {liq.kids.sinGuia} sesiones Kids del mes están en salones <b>sin guía asignada</b> en KIDS: no se le cargan a nadie hasta asignar la guía del salón.</div>}
          {liq.kids.guiaSinEnlace.length > 0 && <div>• Guías de KIDS sin ficha enlazada en la pestaña Advisors: {liq.kids.guiaSinEnlace.map(g => `${g.username} (${g.sesiones} ses.)`).join(', ')}.</div>}
        </div>
      )}

      {loading && !liq ? (
        <p className="p-10 text-center text-sm text-gray-400 italic">Calculando horas…</p>
      ) : !liq || !secciones.length ? null : (
        <div className="overflow-auto max-h-[70vh] rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            {secciones.map(({ programa, pais }) => {
              const lista = visibles.filter(a => a.programaLiq === programa && a.pais === pais)
              if (!lista.length) return null
              const kids = programa === 'KIDS'
              return (
                <tbody key={`${programa}-${pais}`} className="border-b-4 border-gray-200">
                  <tr><td colSpan={99} className={`sticky left-0 ${kids ? 'bg-fuchsia-700' : 'bg-sky-800'} text-white px-3 py-1.5 text-xs font-bold tracking-wide`}>
                    {kids ? 'KIDS · ' : ''}{pais.toUpperCase()} · {MONEDA[pais]} · corte {CORTE[pais]} · {etiquetaPeriodo(liq.periodo)}{liq.parcial ? ' (parcial)' : ''}
                  </td></tr>
                  {encabezado(pais)}
                  {lista.map(fila)}
                  {subtotal(lista, `Subtotal ${kids ? 'Kids ' : ''}${pais}`, pais, kids ? 'bg-fuchsia-50 border-t border-fuchsia-200 text-fuchsia-900' : 'bg-sky-50 border-t border-sky-200 text-sky-900')}
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
            <div className="flex gap-1 border-b px-4">
              {([['corte', 'Corte y factura'], ['eventos', 'Eventos'], ['historial', 'Historial']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => k === 'historial' ? verHistorial(detalle) : setPestana(k)}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${pestana === k ? 'border-sky-700 text-sky-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
              ))}
            </div>
            <div className="overflow-auto">
              {pestana === 'corte' ? (
                <CorteGestion a={detalle} cortes={cortesDe(detalle)} periodo={liq!.periodo} semanas={semanas} permisos={permisos} onCambio={onCambio} />
              ) : pestana === 'historial' ? (
                historial === null ? <p className="p-8 text-center text-sm text-gray-400 italic">Cargando historial…</p>
                  : !historial.length ? <p className="p-8 text-center text-sm text-gray-500">Sin movimientos en el mes.</p> : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase tracking-wide">
                      <tr><th className="px-3 py-2 text-left">Fecha</th><th className="text-left">Corte</th><th className="text-left">Acción</th><th className="text-left">Estado</th><th className="text-left">Quién</th><th className="text-left pr-3">Detalle</th></tr>
                    </thead>
                    <tbody>
                      {historial.map((h, i) => (
                        <tr key={i} className="border-b border-gray-100 align-top">
                          <td className="px-3 py-1 whitespace-nowrap">{new Date(h._createdDate).toLocaleString('es-CO')}</td>
                          <td>{h.programa ? `${h.programa} ${h.corte}` : '—'}</td>
                          <td className="font-semibold">{h.accion}</td>
                          <td className="whitespace-nowrap">{h.estadoAnterior ? `${h.estadoAnterior} → ${h.estadoNuevo}` : ''}</td>
                          <td>{h.usuarioEmail} <span className="text-gray-400">{h.usuarioRol}</span></td>
                          <td className="pr-3 max-w-[340px] text-gray-600 break-words">{h.detalle?.motivo || h.detalle?.comentario || h.detalle?.referencia || (h.detalle?.horas !== undefined ? `${h.detalle.horas} h` : '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : cargandoDet ? <p className="p-8 text-center text-sm text-gray-400 italic">Cargando eventos…</p> : (
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
