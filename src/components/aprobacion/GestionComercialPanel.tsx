'use client'

/**
 * Libro de Producción › pestaña "Gestión" (Gestión Comercial).
 * Filtros globales Año y Mes comercial (Todos o uno) para las dos subpestañas:
 *  - Resumen: tabla por semana (o por mes si es "Todos") con realizadas, aprobadas, rechazadas,
 *    devueltas, firmadas sin aprobar y pendientes; debajo, una caja por filial (filtro País/Filial).
 *  - Por asesor: cada persona de la escala con su cargo (Ej. Training … Sales Manager), filtros
 *    País / Filial / Cargo / Asesor, de mayor a menor.
 * Datos: GET /api/postgres/libro-produccion/gestion (permiso APROBACION.LIBRO_PRODUCCION.GESTION).
 */

import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'
import { exportToExcel } from '@/lib/export-excel'
import { MESES, etiquetaSemana, semanasDeVigencia, type Vigencia } from '@/lib/vigencias-comerciales'

type Grupo = 'aprobada' | 'rechazada' | 'devuelta' | 'firmadaSinAprobar' | 'pendiente'
interface Fila {
  anio: number; mes: number; semana: number | null; pais: string; filial: string; grupo: Grupo; estado: string
  escala: Record<CargoKey, string>
}
type CargoKey = 'ejTraining' | 'fullExecutive' | 'jefeGrupo' | 'gerente' | 'gerenteDivision' | 'salesManager'
const CARGOS: [CargoKey, string][] = [
  ['ejTraining', 'Ej. Training'], ['fullExecutive', 'Full Executive'], ['jefeGrupo', 'Jefe de grupo'],
  ['gerente', 'Gerente'], ['gerenteDivision', 'Gerente división'], ['salesManager', 'Sales Manager'],
]
const COLS: [Grupo | 'total', string, string][] = [
  ['total', 'Realizadas', 'text-gray-900'],
  ['aprobada', 'Aprobadas', 'text-green-700'],
  ['rechazada', 'Rechazadas', 'text-red-700'],
  ['devuelta', 'Devueltas', 'text-orange-700'],
  ['firmadaSinAprobar', 'Firmadas sin aprobar', 'text-amber-700'],
  ['pendiente', 'Pendientes (otro estado)', 'text-slate-600'],
]
type Conteo = Record<Grupo | 'total', number>
const vacio = (): Conteo => ({ total: 0, aprobada: 0, rechazada: 0, devuelta: 0, firmadaSinAprobar: 0, pendiente: 0 })
const contar = (filas: Fila[]) => filas.reduce((c, f) => { c.total++; c[f.grupo]++; return c }, vacio())
const pct = (c: Conteo) => (c.total ? `${Math.round((c.aprobada / c.total) * 100)}%` : '—')
/** Clave para agrupar un nombre escrito de varias formas (mayúsculas, tildes, espacios). */
const clave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function TablaConteo({ filas, titulo, primera }: { filas: { etiqueta: string; c: Conteo }[]; titulo?: string; primera: string }) {
  const total = filas.reduce((t, f) => { (Object.keys(t) as (keyof Conteo)[]).forEach(k => { t[k] += f.c[k] }); return t }, vacio())
  return (
    <div className="overflow-x-auto">
      {titulo && <div className="px-3 pt-2 text-sm font-semibold text-gray-800">{titulo}</div>}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2 text-left">{primera}</th>
            {COLS.map(([k, l]) => <th key={k} className="px-3 py-2 text-right">{l}</th>)}
            <th className="px-3 py-2 text-right">% Aprob.</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.etiqueta} className="border-b border-gray-100">
              <td className="px-3 py-1.5 font-medium text-gray-800">{f.etiqueta}</td>
              {COLS.map(([k, , cls]) => <td key={k} className={`px-3 py-1.5 text-right tabular-nums ${f.c[k] ? cls : 'text-gray-300'}`}>{f.c[k]}</td>)}
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{pct(f.c)}</td>
            </tr>
          ))}
          <tr className="bg-indigo-50 font-bold">
            <td className="px-3 py-1.5 text-indigo-900">Total</td>
            {COLS.map(([k, , cls]) => <td key={k} className={`px-3 py-1.5 text-right tabular-nums ${cls}`}>{total[k]}</td>)}
            <td className="px-3 py-1.5 text-right tabular-nums text-indigo-900">{pct(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const sel = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm'
const Lbl = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <label className="text-xs text-gray-600"><span className="mb-0.5 block">{t}</span>{children}</label>
)

export default function GestionComercialPanel() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState<number>(hoy.getMonth() + 1) // 0 = todos
  const [data, setData] = useState<{ anios: number[]; vigencias: Vigencia[]; filas: Fila[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sub, setSub] = useState<'resumen' | 'asesor'>('resumen')

  const cargar = async () => {
    setLoading(true)
    try {
      setData(await api.get(`/api/postgres/libro-produccion/gestion?anio=${anio}${mes ? `&mes=${mes}` : ''}`))
    } catch (e) { handleApiError(e, 'No se pudo cargar la gestión comercial') } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [anio, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtros de las subpestañas
  const [pais, setPais] = useState('')
  const [filial, setFilial] = useState('')
  const [cargo, setCargo] = useState<CargoKey | ''>('')
  const [asesor, setAsesor] = useState('')

  const filas = data?.filas || []
  const paises = useMemo(() => Array.from(new Set(filas.map(f => f.pais))).sort(), [filas])
  const delPais = useMemo(() => filas.filter(f => !pais || f.pais === pais), [filas, pais])
  const filiales = useMemo(() => Array.from(new Set(delPais.map(f => f.filial))).sort(), [delPais])
  useEffect(() => { if (filial && !filiales.includes(filial)) setFilial('') }, [filiales, filial])

  // Filas de la tabla principal: semanas del mes elegido, o meses si es "Todos".
  const porPeriodo = (lista: Fila[]) => {
    if (mes) {
      const v = data?.vigencias[0]
      const sem = v ? semanasDeVigencia(v) : []
      return sem.map(s => ({ etiqueta: `Semana ${s.etiqueta} · ${s.inicio.slice(8, 10)}/${s.inicio.slice(5, 7)}`, c: contar(lista.filter(f => f.semana === s.numero)) }))
    }
    return (data?.vigencias || []).map(v => ({ etiqueta: MESES[v.mes - 1], c: contar(lista.filter(f => f.mes === v.mes)) }))
  }

  const cajasFilial = useMemo(() => {
    const m = new Map<string, Fila[]>()
    for (const f of delPais) {
      if (filial && f.filial !== filial) continue
      const k = `${f.filial}|${f.pais}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(f)
    }
    return Array.from(m.entries()).map(([k, l]) => ({ filial: k.split('|')[0], pais: k.split('|')[1], filas: l }))
      .sort((a, b) => b.filas.length - a.filas.length)
  }, [delPais, filial])

  // ── Por asesor: una fila por persona × cargo; el nombre se agrupa sin tildes/mayúsculas ──
  const asesores = useMemo(() => {
    const base = delPais.filter(f => !filial || f.filial === filial)
    const m = new Map<string, { cargo: CargoKey; nombres: Map<string, number>; filas: Fila[] }>()
    for (const f of base) {
      for (const [k] of CARGOS) {
        if (cargo && k !== cargo) continue
        const n = f.escala[k]
        if (!n) continue
        const id = `${k}|${clave(n)}`
        if (!m.has(id)) m.set(id, { cargo: k, nombres: new Map(), filas: [] })
        const g = m.get(id)!
        g.nombres.set(n, (g.nombres.get(n) || 0) + 1)
        g.filas.push(f)
      }
    }
    const masComun = (mp: Map<string, number>) => Array.from(mp.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    return Array.from(m.values()).map(g => {
      const nombre = masComun(g.nombres)
      // Escala habitual por encima del cargo: el nombre más frecuente de cada cargo superior.
      const idx = CARGOS.findIndex(([k]) => k === g.cargo)
      const escala = CARGOS.slice(idx + 1).map(([k, l]) => {
        const mp = new Map<string, number>()
        g.filas.forEach(f => { if (f.escala[k]) mp.set(f.escala[k], (mp.get(f.escala[k]) || 0) + 1) })
        const v = masComun(mp)
        return v ? `${l}: ${v}` : ''
      }).filter(Boolean)
      const fil = new Map<string, number>()
      g.filas.forEach(f => fil.set(f.filial, (fil.get(f.filial) || 0) + 1))
      return { nombre, cargo: g.cargo, filial: masComun(fil), escala, c: contar(g.filas) }
    })
      .filter(a => !asesor || clave(a.nombre).includes(clave(asesor)))
      .sort((a, b) => b.c.total - a.c.total || b.c.aprobada - a.c.aprobada)
  }, [delPais, filial, cargo, asesor])
  // Total de la tabla por asesor: contratos DISTINTOS que cumplen los filtros (sin repetir por persona).
  const totalAsesores = useMemo(() => contar(delPais.filter(f =>
    (!filial || f.filial === filial) &&
    CARGOS.some(([k]) => (!cargo || k === cargo) && f.escala[k] && (!asesor || clave(f.escala[k]).includes(clave(asesor)))))), [delPais, filial, cargo, asesor])
  const nombresAsesores = useMemo(() => Array.from(new Set(asesores.map(a => a.nombre))).sort(), [asesores])

  const periodo = `${mes ? MESES[mes - 1] + ' ' : ''}${anio}`
  const exportar = () => {
    if (sub === 'asesor') {
      exportToExcel(asesores, [
        { header: 'Asesor', accessor: a => a.nombre },
        { header: 'Cargo', accessor: a => CARGOS.find(([k]) => k === a.cargo)?.[1] },
        { header: 'Filial', accessor: a => a.filial },
        ...COLS.map(([k, l]) => ({ header: l, accessor: (a: any) => a.c[k] })),
        { header: 'Escala', accessor: a => a.escala.join(' · ') },
      ], `gestion-comercial-asesores-${anio}${mes ? '-' + mes : ''}`)
    } else {
      const filasX = cajasFilial.map(f => ({ filial: f.filial, pais: f.pais, c: contar(f.filas) }))
      exportToExcel(filasX, [
        { header: 'Filial', accessor: f => f.filial }, { header: 'País', accessor: f => f.pais },
        ...COLS.map(([k, l]) => ({ header: l, accessor: (f: any) => f.c[k] })),
      ], `gestion-comercial-filiales-${anio}${mes ? '-' + mes : ''}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestión Comercial</h2>
          <p className="text-xs text-gray-500">Contratos por mes comercial (vigencias), sin contratos de prueba. "Pendientes" = sin firmar, anulados, retractados u otro estado.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Lbl t="Año">
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={sel}>
              {Array.from(new Set([...(data?.anios || []), anio])).sort((a, b) => b - a).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Lbl>
          <Lbl t="Mes">
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className={sel}>
              <option value={0}>Todos</option>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Lbl>
          <button type="button" onClick={cargar} disabled={loading} title="Actualizar" className="mb-0.5 rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50 disabled:opacity-40">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={exportar} disabled={!filas.length}
            className="mb-0.5 inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40">
            <ArrowDownTrayIcon className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {([['resumen', 'Resumen por semana y filial'], ['asesor', 'Por asesor y escala']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSub(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${sub === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
        ))}
      </div>

      {!data && loading ? <p className="p-10 text-center text-sm italic text-gray-400">Cargando…</p>
        : !data?.vigencias.length ? <p className="p-10 text-center text-sm text-gray-500">No hay vigencias comerciales cargadas para {periodo}.</p>
        : sub === 'resumen' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <Lbl t="Plataforma">
                <select value={pais} onChange={e => setPais(e.target.value)} className={sel}>
                  <option value="">Todas</option>
                  {paises.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Lbl>
            </div>
            <section className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-800">
                Resumen {periodo} · {pais || 'todas las plataformas'}
              </div>
              <TablaConteo filas={porPeriodo(delPais)} primera={mes ? 'Semana' : 'Mes'} />
            </section>

            <div className="flex flex-wrap items-end gap-3">
              <Lbl t={`Filial${pais ? ` (${pais})` : ''}`}>
                <select value={filial} onChange={e => setFilial(e.target.value)} className={sel}>
                  <option value="">Todas</option>
                  {filiales.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Lbl>
              <span className="pb-2 text-xs text-gray-500">{cajasFilial.length} filial(es), de mayor a menor</span>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {cajasFilial.map(f => (
                <section key={`${f.filial}|${f.pais}`} className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-sm">
                    <span className="font-semibold text-gray-800">{f.filial}</span>
                    <span className="text-xs text-gray-500">{f.pais} · {f.filas.length} contrato(s)</span>
                  </div>
                  <TablaConteo filas={porPeriodo(f.filas)} primera={mes ? 'Semana' : 'Mes'} />
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Lbl t="Plataforma">
                <select value={pais} onChange={e => setPais(e.target.value)} className={sel}>
                  <option value="">Todas</option>
                  {paises.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Lbl>
              <Lbl t="Filial">
                <select value={filial} onChange={e => setFilial(e.target.value)} className={sel}>
                  <option value="">Todas</option>
                  {filiales.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Lbl>
              <Lbl t="Cargo">
                <select value={cargo} onChange={e => setCargo(e.target.value as CargoKey | '')} className={sel}>
                  <option value="">Todos</option>
                  {CARGOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Lbl>
              <Lbl t="Asesor">
                <input value={asesor} onChange={e => setAsesor(e.target.value)} list="gc-asesores" placeholder="Todos"
                  className={`${sel} w-56`} />
                <datalist id="gc-asesores">{nombresAsesores.map(n => <option key={n} value={n} />)}</datalist>
              </Lbl>
              <span className="pb-2 text-xs text-gray-500">{asesores.length} persona(s) · de mayor a menor</span>
            </div>
            <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Asesor</th>
                    <th className="px-3 py-2 text-left">Cargo</th>
                    <th className="px-3 py-2 text-left">Filial</th>
                    {COLS.map(([k, l]) => <th key={k} className="px-3 py-2 text-right">{l}</th>)}
                    <th className="px-3 py-2 text-right">% Aprob.</th>
                    <th className="px-3 py-2 text-left">Escala</th>
                  </tr>
                </thead>
                <tbody>
                  {asesores.map((a, i) => (
                    <Fragment key={`${a.cargo}|${a.nombre}`}>
                      <tr className="border-b border-gray-100 align-top">
                        <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900">{a.nombre}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap"><span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">{CARGOS.find(([k]) => k === a.cargo)?.[1]}</span></td>
                        <td className="px-3 py-1.5 text-gray-600">{a.filial}</td>
                        {COLS.map(([k, , cls]) => <td key={k} className={`px-3 py-1.5 text-right tabular-nums ${a.c[k] ? cls : 'text-gray-300'}`}>{a.c[k]}</td>)}
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{pct(a.c)}</td>
                        <td className="px-3 py-1.5 text-[11px] text-gray-500">{a.escala.join(' · ') || '—'}</td>
                      </tr>
                    </Fragment>
                  ))}
                  {!asesores.length && <tr><td colSpan={12} className="p-8 text-center text-sm text-gray-500">Sin datos con estos filtros.</td></tr>}
                  {asesores.length > 0 && (
                    <tr className="bg-indigo-50 font-bold">
                      <td colSpan={4} className="px-3 py-1.5 text-indigo-900">Total contratos (sin repetir)</td>
                      {COLS.map(([k, , cls]) => <td key={k} className={`px-3 py-1.5 text-right tabular-nums ${cls}`}>{totalAsesores[k]}</td>)}
                      <td className="px-3 py-1.5 text-right tabular-nums text-indigo-900">{pct(totalAsesores)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <p className="text-[11px] text-gray-400">
              Un contrato cuenta para cada persona de su escala (Ej. Training, Full Executive, Jefe de grupo, Gerente, Gerente división y Sales Manager);
              por eso, con "Cargo: Todos", la suma de las filas es mayor que el total, que cuenta cada contrato una sola vez.
            </p>
          </div>
        )}
    </div>
  )
}
