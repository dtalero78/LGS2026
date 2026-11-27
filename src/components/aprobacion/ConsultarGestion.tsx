'use client'

/**
 * Libro de Producción › Gestión › «Consultar y comparar» (acordado 2026-11-27).
 *
 * Se elige un tipo (Asesor = persona · cargo de la escala, Filial o País) y hasta 4
 * selecciones del MISMO tipo. Dos vistas:
 *  - Vigencia actual: tabla lado a lado (los seis estados con %, Generadas y % Aprob.),
 *    mejor valor resaltado, y debajo la lista de matrículas de cada selección.
 *  - Contra vigencias: cada selección en el período elegido arriba contra otra vigencia
 *    (por defecto la anterior), con la diferencia.
 * Usa las filas que ya cargó la pestaña Gestión (sin contratos de prueba ni CANJE); la
 * vigencia de comparación se pide a GET /api/postgres/libro-produccion/gestion.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownTrayIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'
import { exportToExcel } from '@/lib/export-excel'
import { MESES } from '@/lib/vigencias-comerciales'
import {
  CARGOS, COLS, ESTADO_CLS, clave, contar, pct,
  type CargoKey, type Conteo, type Fila, type Grupo,
} from './gestion-comun'
import type { Celda } from './GestionComercialPanel'

type Tipo = 'asesor' | 'filial' | 'pais'
const TIPOS: [Tipo, string][] = [['asesor', 'Asesor'], ['filial', 'Filial'], ['pais', 'País']]
const MAX = 4
/** Para estas filas gana el valor MÁS BAJO; para Aprobadas y % Aprob. el más alto. */
const MENOS_ES_MEJOR: (Grupo | 'total')[] = ['rechazada', 'retractada', 'pendiente']
const GRUPOS = COLS.filter(([k]) => k !== 'total') as [Grupo, string, string, string][]

interface Opcion { key: string; label: string; cargo?: CargoKey; n: number }

/** ¿La fila pertenece a la selección? Asesor = `cargo|nombre normalizado`. */
function pertenece(f: Fila, tipo: Tipo, key: string) {
  if (tipo === 'pais') return f.pais === key
  if (tipo === 'filial') return `${f.filial}|${f.pais}` === key
  const [cargo, nom] = key.split('|') as [CargoKey, string]
  return !!f.escala[cargo] && clave(f.escala[cargo]) === nom
}

function opcionesDe(filas: Fila[], tipo: Tipo): Opcion[] {
  const m = new Map<string, { label: string; cargo?: CargoKey; n: number; nombres?: Map<string, number> }>()
  for (const f of filas) {
    if (tipo === 'pais') {
      const g = m.get(f.pais) || { label: f.pais, n: 0 }; g.n++; m.set(f.pais, g)
    } else if (tipo === 'filial') {
      const k = `${f.filial}|${f.pais}`
      const g = m.get(k) || { label: `${f.filial} (${f.pais})`, n: 0 }; g.n++; m.set(k, g)
    } else {
      for (const [c] of CARGOS) {
        const nom = f.escala[c]; if (!nom) continue
        const k = `${c}|${clave(nom)}`
        const g = m.get(k) || { label: '', cargo: c, n: 0, nombres: new Map() }
        g.n++; g.nombres!.set(nom, (g.nombres!.get(nom) || 0) + 1); m.set(k, g)
      }
    }
  }
  return Array.from(m.entries()).map(([key, g]) => {
    if (tipo !== 'asesor') return { key, label: g.label, n: g.n }
    const nombre = Array.from(g.nombres!.entries()).sort((a, b) => b[1] - a[1])[0][0]
    return { key, label: `${nombre} · ${CARGOS.find(([c]) => c === g.cargo)?.[1]}`, cargo: g.cargo, n: g.n }
  }).sort((a, b) => b.n - a.n)
}

const fmtPct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '—')

export default function ConsultarGestion({ filas, anio, mes, anios, onCelda, onAbrir }: {
  filas: Fila[]; anio: number; mes: number; anios: number[]
  onCelda: (c: Celda) => void
  onAbrir?: (titularId: string, ids: string[]) => void
}) {
  const [tipo, setTipo] = useState<Tipo>('asesor')
  const [sel, setSel] = useState<string[]>([''])
  const [vista, setVista] = useState<'actual' | 'contra'>('actual')
  const periodo = `${mes ? MESES[mes - 1] + ' ' : ''}${anio}`

  const opciones = useMemo(() => opcionesDe(filas, tipo), [filas, tipo])
  const labelDe = (k: string) => opciones.find(o => o.key === k)?.label || (tipo === 'asesor' ? k.split('|')[1] : k.split('|')[0])
  const elegidas = sel.filter(Boolean)

  const cambiarTipo = (t: Tipo) => { setTipo(t); setSel(['']) }
  const setSelI = (i: number, v: string) => setSel(s => s.map((x, j) => (j === i ? v : x)))
  const quitar = (i: number) => setSel(s => (s.length === 1 ? [''] : s.filter((_, j) => j !== i)))
  /** Opciones para la casilla i: sin las ya elegidas; con asesor, primero las del mismo cargo que la primera. */
  const opcionesPara = (i: number) => {
    const usadas = new Set(sel.filter((x, j) => x && j !== i))
    const lista = opciones.filter(o => !usadas.has(o.key))
    const cargo0 = tipo === 'asesor' && i > 0 && sel[0] ? sel[0].split('|')[0] : null
    return cargo0 ? [...lista.filter(o => o.cargo === cargo0), ...lista.filter(o => o.cargo !== cargo0)] : lista
  }

  const datos = useMemo(() => elegidas.map(k => {
    const l = filas.filter(f => pertenece(f, tipo, k))
    return { key: k, label: labelDe(k), filas: l, c: contar(l) }
  }), [elegidas.join('¦'), filas, tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Contra vigencias: período de comparación (por defecto el anterior) ──
  const [cAnio, setCAnio] = useState(mes ? (mes === 1 ? anio - 1 : anio) : anio - 1)
  const [cMes, setCMes] = useState(mes ? (mes === 1 ? 12 : mes - 1) : 0)
  useEffect(() => { setCAnio(mes ? (mes === 1 ? anio - 1 : anio) : anio - 1); setCMes(mes ? (mes === 1 ? 12 : mes - 1) : 0) }, [anio, mes])
  const [otras, setOtras] = useState<Fila[] | null>(null)
  const [cargandoOtra, setCargandoOtra] = useState(false)
  useEffect(() => {
    if (vista !== 'contra') return
    let vivo = true
    setCargandoOtra(true); setOtras(null)
    api.get<{ filas: Fila[] }>(`/api/postgres/libro-produccion/gestion?anio=${cAnio}${cMes ? `&mes=${cMes}` : ''}`)
      .then(d => { if (vivo) setOtras(d.filas || []) })
      .catch(e => handleApiError(e, 'No se pudo cargar la vigencia de comparación'))
      .finally(() => { if (vivo) setCargandoOtra(false) })
    return () => { vivo = false }
  }, [vista, cAnio, cMes])
  const periodoOtro = `${cMes ? MESES[cMes - 1] + ' ' : ''}${cAnio}`
  const datosOtro = useMemo(() => elegidas.map(k => {
    const l = (otras || []).filter(f => pertenece(f, tipo, k))
    return { key: k, filas: l, c: contar(l) }
  }), [elegidas.join('¦'), otras, tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Índices con el mejor valor de una fila (solo si hay más de una selección y no todos empatan). */
  const mejores = (valores: number[], menosEsMejor: boolean) => {
    if (valores.length < 2) return new Set<number>()
    const obj = menosEsMejor ? Math.min(...valores) : Math.max(...valores)
    if (valores.every(v => v === obj)) return new Set<number>()
    return new Set(valores.map((v, i) => (v === obj ? i : -1)).filter(i => i >= 0))
  }
  const tasa = (c: Conteo) => (c.total ? c.aprobada / c.total : 0)

  const exportar = () => {
    if (vista === 'actual') {
      exportToExcel(datos, [
        { header: tipo === 'asesor' ? 'Asesor · cargo' : tipo === 'filial' ? 'Filial' : 'País', accessor: d => d.label },
        ...COLS.flatMap(([k, l]) => [
          { header: l, accessor: (d: any) => d.c[k] },
          ...(k !== 'total' ? [{ header: `${l} %`, accessor: (d: any) => fmtPct(d.c[k], d.c.total) }] : []),
        ]),
        { header: '% Aprob.', accessor: d => pct(d.c) },
      ], `gestion-comparar-${tipo}-${anio}${mes ? '-' + mes : ''}`)
    } else {
      const filasX = datos.flatMap((d, i) => COLS.map(([k, l]) => ({
        sel: d.label, estado: l, actual: d.c[k], otro: datosOtro[i]?.c[k] ?? 0,
      })))
      exportToExcel(filasX, [
        { header: tipo === 'asesor' ? 'Asesor · cargo' : tipo === 'filial' ? 'Filial' : 'País', accessor: x => x.sel },
        { header: 'Estado', accessor: x => x.estado },
        { header: periodo, accessor: x => x.actual },
        { header: periodoOtro, accessor: x => x.otro },
        { header: 'Diferencia', accessor: x => x.actual - x.otro },
      ], `gestion-contra-vigencias-${tipo}-${anio}${mes ? '-' + mes : ''}`)
    }
  }

  const [listaDe, setListaDe] = useState(0)
  const [estadoLista, setEstadoLista] = useState<Grupo | ''>('')
  useEffect(() => { if (listaDe >= datos.length) setListaDe(0) }, [datos.length, listaDe])
  const lista = (datos[listaDe]?.filas || []).filter(f => !estadoLista || f.grupo === estadoLista)
    .sort((a, b) => a.contrato.localeCompare(b.contrato))
  const conTitular = filas.some(f => f.titular !== undefined)

  const sel_ = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm'

  return (
    <div className="space-y-4">
      {/* Selección */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-0.5 block text-xs text-gray-600">Consultar por</span>
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
              {TIPOS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => cambiarTipo(k)}
                  className={`px-3 py-1.5 text-sm ${tipo === k ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{l}</button>
              ))}
            </div>
          </div>
          <span className="pb-2 text-xs text-gray-500">Período: <b className="text-gray-700">{periodo}</b> (Año y Mes de arriba) · sin contratos de prueba ni canje</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {sel.map((v, i) => (
            <label key={i} className="text-xs text-gray-600">
              <span className="mb-0.5 block">{i === 0 ? (tipo === 'asesor' ? 'Asesor · cargo' : tipo === 'filial' ? 'Filial' : 'País') : `Comparar con (${i + 1})`}</span>
              <span className="flex items-center gap-1">
                <select value={v} onChange={e => setSelI(i, e.target.value)} className={`${sel_} w-72`}>
                  <option value="">— Elegir —</option>
                  {opcionesPara(i).map(o => <option key={o.key} value={o.key}>{o.label} ({o.n})</option>)}
                </select>
                {(sel.length > 1 || v) && (
                  <button type="button" onClick={() => quitar(i)} title="Quitar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><XMarkIcon className="h-4 w-4" /></button>
                )}
              </span>
            </label>
          ))}
          {sel.length < MAX && sel[sel.length - 1] && (
            <button type="button" onClick={() => setSel(s => [...s, ''])}
              className="mb-0.5 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
              <PlusIcon className="h-4 w-4" /> Comparar
            </button>
          )}
        </div>
        {tipo === 'asesor' && <p className="text-[11px] text-gray-400">Cada persona se elige con su cargo: cuenta los contratos donde ocupa ese cargo en la escala (mismos números que «Por asesor y escala»).</p>}
      </section>

      {!elegidas.length ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">Elige {tipo === 'asesor' ? 'un asesor' : tipo === 'filial' ? 'una filial' : 'un país'} para ver sus matrículas.</p>
      ) : (<>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200">
          <div className="flex gap-2">
            {([['actual', `Vigencia actual · ${periodo}`], ['contra', 'Contra vigencias']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setVista(k)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${vista === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={exportar} disabled={vista === 'contra' && !otras}
            className="mb-1 inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40">
            <ArrowDownTrayIcon className="h-4 w-4" /> Excel
          </button>
        </div>

        {vista === 'actual' ? (<>
          <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left">Estado</th>
                  {datos.map(d => <th key={d.key} className="px-3 py-2 text-right normal-case text-xs font-semibold text-gray-800">{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {COLS.map(([k, l, cls, ayuda]) => {
                  const best = k === 'total' ? new Set<number>() : mejores(datos.map(d => d.c[k]), MENOS_ES_MEJOR.includes(k))
                  return (
                    <tr key={k} className={`border-b border-gray-100 ${k === 'total' ? 'bg-indigo-50 font-bold' : ''}`}>
                      <td className="px-3 py-1.5 font-medium text-gray-800 cursor-help" title={ayuda}>{l}</td>
                      {datos.map((d, i) => {
                        const n = d.c[k]
                        const sub = k === 'total' ? d.filas : d.filas.filter(f => f.grupo === k)
                        return (
                          <td key={d.key} className={`px-3 py-1.5 text-right tabular-nums ${best.has(i) ? 'bg-green-50 ring-1 ring-inset ring-green-300' : ''}`}>
                            {n ? (
                              <button type="button" onClick={() => onCelda({ titulo: `${d.label} · ${periodo} · ${l}`, filas: sub })}
                                className={`${cls} rounded px-1 underline decoration-dotted underline-offset-2 hover:bg-indigo-50`}>{n}</button>
                            ) : <span className="text-gray-300">0</span>}
                            {k !== 'total' && <span className="ml-1 text-[11px] text-gray-400">{fmtPct(n, d.c.total)}</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                <tr className="font-bold">
                  <td className="px-3 py-1.5 text-indigo-900">% Aprob.</td>
                  {(() => {
                    const best = mejores(datos.map(d => Math.round(tasa(d.c) * 1000)), false)
                    return datos.map((d, i) => (
                      <td key={d.key} className={`px-3 py-1.5 text-right tabular-nums text-indigo-900 ${best.has(i) ? 'bg-green-50 ring-1 ring-inset ring-green-300' : ''}`}>{pct(d.c)}</td>
                    ))
                  })()}
                </tr>
              </tbody>
            </table>
            {datos.length > 1 && <p className="px-3 py-2 text-[11px] text-gray-400">En verde, el mejor valor de cada fila (más alto en Aprobadas y % Aprob.; más bajo en Rechazadas, Retractadas y Pendientes).</p>}
          </section>

          {/* Lista de matrículas por selección */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 pt-2">
              <div className="flex flex-wrap gap-1">
                {datos.map((d, i) => (
                  <button key={d.key} type="button" onClick={() => setListaDe(i)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium ${listaDe === i ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {d.label} ({d.c.total})
                  </button>
                ))}
              </div>
              <select value={estadoLista} onChange={e => setEstadoLista(e.target.value as Grupo | '')} className={`${sel_} mb-1 text-xs`}>
                <option value="">Todos los estados</option>
                {GRUPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">N° Contrato</th>
                    {conTitular && <th className="px-3 py-2 text-left">Titular</th>}
                    <th className="px-3 py-2 text-left">Asesor</th>
                    <th className="px-3 py-2 text-left">Filial</th>
                    <th className="px-3 py-2 text-left">País</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f, i) => (
                    <tr key={f.titularId} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {onAbrir
                          ? <button type="button" onClick={() => onAbrir(f.titularId, lista.map(x => x.titularId))} title="Abrir el contrato" className="font-medium text-indigo-700 hover:underline">{f.contrato}</button>
                          : <span className="font-medium">{f.contrato}</span>}
                      </td>
                      {conTitular && <td className="px-3 py-1.5 text-gray-800">{f.titular || '—'}</td>}
                      <td className="px-3 py-1.5 text-gray-600">{f.escala.ejTraining || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{f.filial}</td>
                      <td className="px-3 py-1.5 text-gray-600">{f.pais}</td>
                      <td className="px-3 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ESTADO_CLS[f.grupo]}`}>{f.estado || f.grupo}</span></td>
                    </tr>
                  ))}
                  {!lista.length && <tr><td colSpan={7} className="p-6 text-center text-sm text-gray-400">Sin matrículas con ese estado.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>) : (
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-end gap-3">
              <span className="pb-2 text-sm text-gray-700"><b>{periodo}</b> contra</span>
              <label className="text-xs text-gray-600">
                <span className="mb-0.5 block">Año</span>
                <select value={cAnio} onChange={e => setCAnio(Number(e.target.value))} className={sel_}>
                  {Array.from(new Set([...anios, cAnio, anio - 1])).sort((a, b) => b - a).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-600">
                <span className="mb-0.5 block">Mes</span>
                <select value={cMes} onChange={e => setCMes(Number(e.target.value))} className={sel_}>
                  <option value={0}>Todos</option>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
              {cAnio === anio && cMes === mes && <span className="pb-2 text-xs text-amber-700">Es el mismo período; elija otra vigencia.</span>}
            </div>
            {cargandoOtra ? <p className="p-6 text-center text-sm italic text-gray-400">Cargando {periodoOtro}…</p> : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase tracking-wide text-gray-500">
                      <th rowSpan={2} className="px-3 py-2 text-left align-bottom">Estado</th>
                      {datos.map(d => <th key={d.key} colSpan={3} className="border-l border-gray-100 px-3 pt-2 text-center normal-case text-xs font-semibold text-gray-800">{d.label}</th>)}
                    </tr>
                    <tr className="border-b text-[10px] uppercase tracking-wide text-gray-500">
                      {datos.map(d => [
                        <th key={d.key + 'a'} className="border-l border-gray-100 px-2 pb-2 text-right">{periodo}</th>,
                        <th key={d.key + 'o'} className="px-2 pb-2 text-right">{periodoOtro}</th>,
                        <th key={d.key + 'd'} className="px-2 pb-2 text-right">Dif.</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {COLS.map(([k, l, cls, ayuda]) => (
                      <tr key={k} className={`border-b border-gray-100 ${k === 'total' ? 'bg-indigo-50 font-bold' : ''}`}>
                        <td className="px-3 py-1.5 font-medium text-gray-800 cursor-help" title={ayuda}>{l}</td>
                        {datos.map((d, i) => {
                          const a = d.c[k]; const o = datosOtro[i]?.c[k] ?? 0; const dif = a - o
                          const bueno = k === 'total' || k === 'aprobada' ? dif > 0 : MENOS_ES_MEJOR.includes(k) ? dif < 0 : null
                          const malo = k === 'total' || k === 'aprobada' ? dif < 0 : MENOS_ES_MEJOR.includes(k) ? dif > 0 : null
                          return [
                            <td key={d.key + 'a'} className={`border-l border-gray-100 px-2 py-1.5 text-right tabular-nums ${a ? cls : 'text-gray-300'}`}>{a}</td>,
                            <td key={d.key + 'o'} className="px-2 py-1.5 text-right tabular-nums text-gray-500">{o}</td>,
                            <td key={d.key + 'd'} className={`px-2 py-1.5 text-right tabular-nums font-semibold ${!dif ? 'text-gray-300' : bueno ? 'text-green-700' : malo ? 'text-red-700' : 'text-gray-600'}`}>{dif > 0 ? `+${dif}` : dif}</td>,
                          ]
                        })}
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="px-3 py-1.5 text-indigo-900">% Aprob.</td>
                      {datos.map((d, i) => {
                        const o = datosOtro[i]?.c || contar([])
                        const dif = o.total && d.c.total ? Math.round((tasa(d.c) - tasa(o)) * 100) : null
                        return [
                          <td key={d.key + 'a'} className="border-l border-gray-100 px-2 py-1.5 text-right tabular-nums text-indigo-900">{pct(d.c)}</td>,
                          <td key={d.key + 'o'} className="px-2 py-1.5 text-right tabular-nums text-gray-500">{pct(o)}</td>,
                          <td key={d.key + 'd'} className={`px-2 py-1.5 text-right tabular-nums ${dif === null || dif === 0 ? 'text-gray-300' : dif > 0 ? 'text-green-700' : 'text-red-700'}`}>{dif === null ? '—' : `${dif > 0 ? '+' : ''}${dif} pts`}</td>,
                        ]
                      })}
                    </tr>
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[11px] text-gray-400">Dif. = {periodo} menos {periodoOtro}. Verde = mejora (más Aprobadas / Generadas o menos Rechazadas, Retractadas y Pendientes); rojo = empeora.</p>
              </div>
            )}
          </section>
        )}
      </>)}
    </div>
  )
}
