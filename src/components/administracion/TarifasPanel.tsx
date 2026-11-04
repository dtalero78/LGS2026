'use client'

/**
 * Gestión Advisors › Tarifas: tarifas por país, programa (LGS/KIDS), tipo (por horas /
 * semiplanta), categoría (ESTANDAR, INTERNACIONAL…) y concepto (normal / festivo /
 * exam. intern.), con vigencia. Cambiar una tarifa desde una fecha = "Nueva vigencia"
 * (se conserva el historial; un corte usa la vigente al inicio del corte).
 * "Sin asistentes" no es tarifa: es 0,5 × NORMAL para los por horas.
 * Editar corrige una tarifa; Borrar la elimina (los cortes verificados/pagados guardan su
 * valor en el snapshot, así que solo cambian los abiertos).
 * Gate: ADMINISTRACION.GESTION_ADVISORS.TARIFAS (edición).
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon, PencilSquareIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

interface Tarifa {
  _id: string; pais: string; programa: string; tipo: string; categoria: string; concepto: string
  moneda: string; valor: number; vigenteDesde: string; activo: boolean; creadoPor: string | null
}
type Form = Omit<Tarifa, '_id' | 'valor' | 'creadoPor'> & { valor: string }

const PAISES = ['Chile', 'Colombia', 'Ecuador']
const MONEDA: Record<string, string> = { Chile: 'CLP', Colombia: 'COP', Ecuador: 'USD' }
const CONCEPTOS = [
  { v: 'NORMAL', l: 'Normal' }, { v: 'FESTIVO', l: 'Festivo' }, { v: 'EXAM_INTERN', l: 'Exam. Intern.' },
]
const TIPOS = [{ v: 'POR_HORAS', l: 'Por horas' }, { v: 'SEMIPLANTA', l: 'Semiplanta' }]
const hoy = () => new Date().toISOString().slice(0, 10)
const fmtF = (v: string) => { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}` }
const fmtV = (n: number, moneda: string) =>
  `${moneda === 'USD' ? 'U$' : '$'}${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${moneda}`
const claveGrupo = (t: { programa: string; tipo: string; categoria: string }) => `${t.programa}|${t.tipo}|${t.categoria}`

export default function TarifasPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const [pais, setPais] = useState('Colombia')
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null) // null cerrado · '' nueva
  const [form, setForm] = useState<Form | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [verHistorial, setVerHistorial] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ tarifas: Tarifa[] }>('/api/postgres/administracion/tarifas')
      setTarifas(d.tarifas || [])
    } catch (e) {
      handleApiError(e, 'No se pudieron cargar las tarifas')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const nueva = (base?: Partial<Form>) => {
    setEditando('')
    setForm({
      pais, programa: 'LGS', tipo: 'POR_HORAS', categoria: 'ESTANDAR', concepto: 'NORMAL',
      moneda: MONEDA[pais], valor: '', vigenteDesde: hoy(), activo: true, ...base,
    })
  }
  const editar = (t: Tarifa) => { setEditando(t._id); setForm({ ...t, valor: String(t.valor) }) }

  const enviar = async (datos: Form, id: string | null) => {
    setGuardando(true)
    try {
      const res = await fetch(id ? `/api/postgres/administracion/tarifas/${id}` : '/api/postgres/administracion/tarifas', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, valor: Number(datos.valor) }),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Tarifa guardada')
      setEditando(null)
      cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (t: Tarifa) => {
    const concepto = CONCEPTOS.find(c => c.v === t.concepto)?.l || t.concepto
    if (!window.confirm(`¿Borrar la tarifa ${concepto} de ${fmtV(t.valor, t.moneda)} vigente desde ${fmtF(t.vigenteDesde)}?\n\n` +
      'Los cortes ya verificados o pagados no cambian. Los abiertos se recalculan con la tarifa que quede vigente.')) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/postgres/administracion/tarifas/${t._id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Tarifa borrada')
      if (editando === t._id) setEditando(null)
      cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar')
    } finally {
      setGuardando(false)
    }
  }

  // Por país: grupos programa × tipo × categoría; en cada concepto la vigente (la más reciente
  // con vigenteDesde ≤ hoy) y, si se pide, el historial.
  const grupos = useMemo(() => {
    const delPais = tarifas.filter(t => t.pais === pais)
    const m = new Map<string, Tarifa[]>()
    for (const t of delPais) { const k = claveGrupo(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t) }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, filas]) => {
      const [programa, tipo, categoria] = k.split('|')
      const porConcepto = CONCEPTOS.map(c => {
        const deC = filas.filter(f => f.concepto === c.v).sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))
        const vigente = deC.find(f => f.activo && f.vigenteDesde <= hoy()) || null
        const futura = deC.find(f => f.activo && f.vigenteDesde > hoy()) || null
        return { concepto: c, vigente, futura, historial: deC }
      })
      return { k, programa, tipo, categoria, porConcepto }
    })
  }, [tarifas, pais])

  const acciones = (t: Tarifa) => (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => editar(t)} disabled={guardando} title="Corregir esta tarifa"
        className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-600 hover:text-sky-700">
        <PencilSquareIcon className="h-3.5 w-3.5" /> Editar
      </button>
      <button type="button" onClick={() => borrar(t)} disabled={guardando} title="Borrar esta tarifa"
        className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 hover:text-red-800">
        <TrashIcon className="h-3.5 w-3.5" /> Borrar
      </button>
    </span>
  )

  const sel = (k: keyof Form, opciones: { v: string; l: string }[], label: string) => (
    <label className="text-xs text-gray-600">
      <span className="block mb-0.5">{label}</span>
      <select value={String(form![k])} onChange={e => setForm(s => ({ ...s!, [k]: e.target.value }))}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
        {opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PAISES.map(p => (
            <button key={p} type="button" onClick={() => { setPais(p); setEditando(null) }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border ${pais === p ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {p} <span className="opacity-70">· {MONEDA[p]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={verHistorial} onChange={e => setVerHistorial(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
            Ver historial
          </label>
          {puedeEditar && (
            <button type="button" onClick={() => nueva()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800">
              <PlusIcon className="h-4 w-4" /> Nueva tarifa
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Tarifas por hora de <b>{pais}</b> en {MONEDA[pais]}. Para cambiar un valor desde una fecha use <b>Nueva vigencia</b>: la anterior queda en el historial. <b>Editar</b> corrige un valor mal digitado y <b>Borrar</b> elimina una tarifa
        (los cortes ya verificados o pagados conservan su valor).
        <b> Sin asistentes</b> = 0,5 × Normal (solo advisors por horas). Kids sin tarifa propia usa la de LGS.
      </p>

      {editando !== null && form && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 space-y-3">
          <div className="text-sm font-semibold text-gray-800">{editando ? 'Editar tarifa' : `Nueva tarifa · ${form.pais}`}</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {sel('programa', [{ v: 'LGS', l: 'LGS' }, { v: 'KIDS', l: 'KIDS' }], 'Programa')}
            {sel('tipo', TIPOS, 'Tipo')}
            <label className="text-xs text-gray-600">
              <span className="block mb-0.5">Categoría</span>
              <input value={form.categoria} onChange={e => setForm(s => ({ ...s!, categoria: e.target.value.toUpperCase() }))}
                placeholder="ESTANDAR" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm uppercase" />
            </label>
            {sel('concepto', CONCEPTOS, 'Concepto')}
            <label className="text-xs text-gray-600">
              <span className="block mb-0.5">Valor por hora ({form.moneda}) *</span>
              <input type="number" min={0} step="any" value={form.valor} onChange={e => setForm(s => ({ ...s!, valor: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-gray-600">
              <span className="block mb-0.5">Vigente desde *</span>
              <input type="date" value={form.vigenteDesde} onChange={e => setForm(s => ({ ...s!, vigenteDesde: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(s => ({ ...s!, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300" /> Activa
            </label>
            <div className="flex gap-2">
              {editando && (
                <button type="button" onClick={() => { const t = tarifas.find(x => x._id === editando); if (t) borrar(t) }} disabled={guardando}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50">
                  <TrashIcon className="h-4 w-4" /> Borrar
                </button>
              )}
              <button type="button" onClick={() => setEditando(null)} disabled={guardando}
                className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={() => enviar(form, editando || null)} disabled={guardando || form.valor === '' || !form.vigenteDesde}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="p-8 text-center text-sm text-gray-400 italic">Cargando…</p>
      ) : !grupos.length ? (
        <p className="p-8 text-center text-sm text-gray-500">No hay tarifas para {pais}.{puedeEditar && <> Use <b>Nueva tarifa</b>.</>}</p>
      ) : grupos.map(g => (
        <div key={g.k} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${g.programa === 'KIDS' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-sky-100 text-sky-800'}`}>{g.programa}</span>
            <span className="font-semibold text-gray-800">{TIPOS.find(t => t.v === g.tipo)?.l || g.tipo}</span>
            <span className="text-gray-400">·</span>
            <span className={`text-xs font-semibold ${g.categoria === 'ESTANDAR' ? 'text-gray-600' : 'text-amber-700'}`}>{g.categoria}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-1.5 w-40">Concepto</th><th>Vigente</th><th>Desde</th><th>Próxima</th><th></th>
              </tr>
            </thead>
            <tbody>
              {g.porConcepto.map(({ concepto, vigente, futura, historial }) => (
                <Fragment key={concepto.v}>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-1.5 font-medium text-gray-900">{concepto.l}</td>
                    <td className="font-semibold tabular-nums">{vigente ? fmtV(vigente.valor, vigente.moneda) : <span className="text-red-600 text-xs">Sin tarifa vigente</span>}</td>
                    <td className="text-xs text-gray-500">{vigente ? fmtF(vigente.vigenteDesde) : '—'}</td>
                    <td className="text-xs text-gray-500">
                      {futura ? <>
                        {fmtV(futura.valor, futura.moneda)} desde {fmtF(futura.vigenteDesde)}
                        {puedeEditar && <span className="ml-2">{acciones(futura)}</span>}
                      </> : '—'}
                    </td>
                    <td className="pr-3 text-right whitespace-nowrap">
                      {puedeEditar && (
                        <>
                          {vigente && acciones(vigente)}
                          <button type="button" onClick={() => nueva({ programa: g.programa, tipo: g.tipo, categoria: g.categoria, concepto: concepto.v })}
                            className="ml-3 inline-flex items-center gap-0.5 text-xs font-medium text-sky-700 hover:underline">
                            <ClockIcon className="h-3.5 w-3.5" /> Nueva vigencia
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {verHistorial && historial.filter(h => h !== vigente && h !== futura).map(h => (
                    <tr key={h._id} className="border-b border-gray-50 bg-gray-50/50 text-xs text-gray-500">
                      <td className="px-4 py-1 pl-8">↳ histórico</td>
                      <td className={`tabular-nums ${h.activo ? '' : 'line-through'}`}>{fmtV(h.valor, h.moneda)}</td>
                      <td>{fmtF(h.vigenteDesde)}</td>
                      <td>{h.creadoPor || ''}</td>
                      <td className="pr-3 text-right">
                        {puedeEditar && acciones(h)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
