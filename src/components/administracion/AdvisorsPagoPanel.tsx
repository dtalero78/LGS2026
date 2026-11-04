'use client'

/**
 * Gestión Advisors › Advisors: ficha de pago de cada advisor — tipo (por horas /
 * semiplanta / planta), categoría de tarifa, programa (LGS / KIDS / ambos), grupo de
 * pago (por defecto su país) y, solo con VER_COMPENSACION, valor fijo mensual, horas
 * contratadas/garantizadas y horas de gestión administrativa.
 * Edición: ADMINISTRACION.GESTION_ADVISORS.FICHA_PAGO.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { api, handleApiError } from '@/hooks/use-api'

interface AdvisorPago {
  _id: string; nombre: string; email: string | null; pais: string | null; activo: boolean; esPlanta: boolean
  tipoContratacion: string; categoriaTarifa: string; programa: string; grupoPago: string | null
  grupoPagoEfectivo: string | null; kidsUserId: string | null
  valorFijoMensual: number | null; horasContratadas: number | null; horasGestionAdmin: number | null
}
type Form = {
  tipoContratacion: string; categoriaTarifa: string; programa: string; grupoPago: string; kidsUserId: string
  valorFijoMensual: string; horasContratadas: string; horasGestionAdmin: string
}

const TIPO: Record<string, { l: string; cls: string }> = {
  POR_HORAS: { l: 'Por horas', cls: 'bg-sky-100 text-sky-800' },
  SEMIPLANTA: { l: 'Semiplanta', cls: 'bg-violet-100 text-violet-800' },
  PLANTA: { l: 'Planta', cls: 'bg-emerald-100 text-emerald-800' },
}
const FILTROS_PAIS = ['Todos', 'Chile', 'Colombia', 'Ecuador']
const s = (v: number | null) => (v === null ? '' : String(v))
const aForm = (a: AdvisorPago): Form => ({
  tipoContratacion: a.tipoContratacion, categoriaTarifa: a.categoriaTarifa, programa: a.programa,
  grupoPago: a.grupoPago || '', kidsUserId: a.kidsUserId || '',
  valorFijoMensual: s(a.valorFijoMensual), horasContratadas: s(a.horasContratadas), horasGestionAdmin: s(a.horasGestionAdmin),
})

export default function AdvisorsPagoPanel({ puedeEditar }: { puedeEditar: boolean }) {
  const [advisors, setAdvisors] = useState<AdvisorPago[]>([])
  const [verComp, setVerComp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pais, setPais] = useState('Todos')
  const [estado, setEstado] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState<AdvisorPago | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ advisors: AdvisorPago[]; verCompensacion: boolean }>('/api/postgres/administracion/advisors')
      setAdvisors(d.advisors || [])
      setVerComp(!!d.verCompensacion)
    } catch (e) {
      handleApiError(e, 'No se pudieron cargar los advisors')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return advisors.filter(a =>
      (pais === 'Todos' || a.grupoPagoEfectivo === pais) &&
      (estado === 'todos' || (estado === 'activos' ? a.activo : !a.activo)) &&
      (!q || a.nombre.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)))
  }, [advisors, pais, estado, buscar])

  const guardar = async () => {
    if (!editando || !form) return
    setGuardando(true)
    try {
      const body: Record<string, any> = {
        tipoContratacion: form.tipoContratacion, categoriaTarifa: form.categoriaTarifa, programa: form.programa,
        grupoPago: form.grupoPago || null, kidsUserId: form.kidsUserId || null,
      }
      if (verComp) {
        body.valorFijoMensual = form.valorFijoMensual === '' ? null : Number(form.valorFijoMensual)
        body.horasContratadas = form.horasContratadas === '' ? null : Number(form.horasContratadas)
        body.horasGestionAdmin = form.horasGestionAdmin === '' ? null : Number(form.horasGestionAdmin)
      }
      const res = await fetch(`/api/postgres/administracion/advisors/${editando._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok || !j?.success) throw new Error(j?.details || j?.error || `Error ${res.status}`)
      toast.success('Ficha de pago guardada')
      setEditando(null)
      cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const fijo = form && form.tipoContratacion !== 'POR_HORAS'
  const input = (k: keyof Form, label: string, type = 'text', hint?: string) => (
    <label className="text-xs text-gray-600">
      <span className="block mb-0.5">{label}</span>
      <input type={type} value={form![k]} onChange={e => setForm(f => ({ ...f!, [k]: type === 'text' && k === 'categoriaTarifa' ? e.target.value.toUpperCase() : e.target.value }))}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      {hint && <span className="block mt-0.5 text-[10px] text-gray-400">{hint}</span>}
    </label>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS_PAIS.map(p => (
          <button key={p} type="button" onClick={() => setPais(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border ${pais === p ? 'bg-sky-700 border-sky-700 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {p}
          </button>
        ))}
        <select value={estado} onChange={e => setEstado(e.target.value as any)} className="ml-2 rounded-md border border-gray-300 px-2 py-1.5 text-xs bg-white">
          <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
        </select>
        <div className="relative ml-auto">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-2 top-2 text-gray-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar advisor…"
            className="pl-7 pr-2 py-1.5 text-sm rounded-md border border-gray-300 w-56" />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        El <b>grupo de pago</b> define moneda, cortes (Colombia por quincena; Chile y Ecuador mensual), festivos y bloqueo SIN FACTURA. Si está vacío se usa el país del advisor.
        La <b>categoría</b> elige la tarifa (ESTANDAR por defecto; p. ej. INTERNACIONAL).
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-3 py-2">Advisor</th><th>País</th><th>Grupo pago</th><th>Programa</th><th>Tipo</th><th>Categoría</th>
              {verComp && <><th className="text-right">Valor fijo</th><th className="text-right">Hrs contrat.</th><th className="text-right">Hrs gestión</th></>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-400 italic">Cargando…</td></tr>
            ) : !visibles.length ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-500">Sin advisors con ese filtro.</td></tr>
            ) : visibles.map(a => (
              <tr key={a._id} className={`border-b border-gray-100 ${a.activo ? '' : 'opacity-60'}`}>
                <td className="px-3 py-1.5">
                  <div className={`font-medium ${a.activo ? 'text-gray-900' : 'text-red-700'}`}>{a.nombre}</div>
                  <div className="text-[11px] text-gray-400">{a.email}</div>
                </td>
                <td className="text-xs">{a.pais || '—'}</td>
                <td className="text-xs">{a.grupoPagoEfectivo || <span className="text-red-600">Sin grupo</span>}{a.grupoPago && a.grupoPago !== a.pais && <span className="ml-1 text-amber-600">(manual)</span>}</td>
                <td><span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${a.programa === 'KIDS' ? 'bg-fuchsia-100 text-fuchsia-800' : a.programa === 'AMBOS' ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-50 text-sky-800'}`}>{a.programa}</span></td>
                <td><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TIPO[a.tipoContratacion]?.cls || ''}`}>{TIPO[a.tipoContratacion]?.l || a.tipoContratacion}</span></td>
                <td className={`text-xs font-semibold ${a.categoriaTarifa === 'ESTANDAR' ? 'text-gray-500' : 'text-amber-700'}`}>{a.categoriaTarifa}</td>
                {verComp && (
                  <>
                    <td className="text-right tabular-nums text-xs">{a.valorFijoMensual !== null ? `$${a.valorFijoMensual.toLocaleString('es-CO')}` : '—'}</td>
                    <td className="text-right tabular-nums text-xs">{a.horasContratadas ?? '—'}</td>
                    <td className="text-right tabular-nums text-xs">{a.horasGestionAdmin ?? '—'}</td>
                  </>
                )}
                <td className="pr-3 text-right">
                  {puedeEditar && (
                    <button type="button" onClick={() => { setEditando(a); setForm(aForm(a)) }} title="Editar ficha de pago" className="p-1 text-gray-500 hover:text-sky-700">
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !guardando && setEditando(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="border-b px-5 py-3">
              <div className="text-base font-semibold text-gray-900">Ficha de pago</div>
              <div className="text-xs text-gray-500">{editando.nombre} · {editando.pais || 'sin país'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5">
              <label className="text-xs text-gray-600">
                <span className="block mb-0.5">Tipo de contratación</span>
                <select value={form.tipoContratacion} onChange={e => setForm(f => ({ ...f!, tipoContratacion: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
                  {Object.entries(TIPO).map(([v, t]) => <option key={v} value={v}>{t.l}</option>)}
                </select>
              </label>
              {input('categoriaTarifa', 'Categoría de tarifa', 'text', 'ESTANDAR, INTERNACIONAL…')}
              <label className="text-xs text-gray-600">
                <span className="block mb-0.5">Programa</span>
                <select value={form.programa} onChange={e => setForm(f => ({ ...f!, programa: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
                  <option value="LGS">LGS</option><option value="KIDS">KIDS</option><option value="AMBOS">LGS y KIDS</option>
                </select>
              </label>
              <label className="text-xs text-gray-600">
                <span className="block mb-0.5">Grupo de pago</span>
                <select value={form.grupoPago} onChange={e => setForm(f => ({ ...f!, grupoPago: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
                  <option value="">Según país ({editando.pais || '—'})</option>
                  <option value="Chile">Chile</option><option value="Colombia">Colombia</option><option value="Ecuador">Ecuador</option>
                </select>
              </label>
              {form.programa !== 'LGS' && input('kidsUserId', 'Usuario en KIDS (UUID)', 'text', 'Enlace con la guía en KIDS2026')}
              {verComp && fijo && (
                <>
                  {input('valorFijoMensual', 'Valor fijo mensual', 'number')}
                  {input('horasContratadas', form.tipoContratacion === 'PLANTA' ? 'Horas contratadas / mes' : 'Horas garantizadas / mes', 'number')}
                  {input('horasGestionAdmin', 'Horas gestión administrativa / mes', 'number')}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={() => setEditando(null)} disabled={guardando}
                className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-sky-700 rounded-md hover:bg-sky-800 disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
