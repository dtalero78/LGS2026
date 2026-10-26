'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { AprobacionPermission } from '@/types/permissions'
import toast from 'react-hot-toast'

interface Beneficiario { _id: string; nombre: string; numeroId: string; aprobacion: string | null; kids: boolean | null }
interface ContratoCanje {
  _id: string
  contrato: string
  primerNombre: string; segundoNombre?: string; primerApellido?: string; segundoApellido?: string
  numeroId: string
  plataforma: string | null
  celular: string | null
  email: string | null
  asesor: string | null
  asesorCreadorContrato: string | null
  aprobacion: string | null
  estado: string | null
  vigencia: string | null
  finalContrato: string | null
  fecha: string | null
  fechaIngreso: string | null
  firmado: boolean
  condicionesCanje: string[] | string | null
  totalPlan: string | number | null
  beneficiarios: Beneficiario[]
}

type Pestana = 'pendientes' | 'aprobados' | 'todos'

const nombre = (c: ContratoCanje) =>
  [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(' ').trim()
const fmtFecha = (v: any) => {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) } catch { return String(v).slice(0, 10) }
}
const fmtValor = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) && n > 0 ? `$ ${n.toLocaleString('es-CO')}` : '—'
}
const condiciones = (c: ContratoCanje): string[] => {
  try {
    const arr = typeof c.condicionesCanje === 'string' ? JSON.parse(c.condicionesCanje) : c.condicionesCanje
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : []
  } catch { return [] }
}
const aprobado = (c: ContratoCanje) => String(c.aprobacion || '').trim() === 'Aprobado'

function ContratosCanje() {
  const { hasPermission } = usePermissions()
  const puedeAprobar = hasPermission(AprobacionPermission.CONTRATOS_CANJE_APROBAR)

  const [rows, setRows] = useState<ContratoCanje[]>([])
  const [loading, setLoading] = useState(true)
  const [pestana, setPestana] = useState<Pestana>('pendientes')
  const [buscar, setBuscar] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<ContratoCanje | null>(null)
  const [aprobando, setAprobando] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/postgres/aprobacion/contratos-canje')
      const j = await r.json()
      if (!r.ok || !j?.success) throw new Error(j?.error || 'No se pudo cargar')
      setRows(j.contratos || [])
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { cargar() }, [])

  const filtradas = useMemo(() => {
    const t = buscar.trim().toLowerCase()
    return rows
      .filter(c => pestana === 'todos' || (pestana === 'aprobados' ? aprobado(c) : !aprobado(c)))
      .filter(c => !t || `${nombre(c)} ${c.numeroId} ${c.contrato}`.toLowerCase().includes(t))
  }, [rows, pestana, buscar])
  const pendientes = rows.filter(c => !aprobado(c)).length

  // Aprobar = mismo proceso que la ficha: aprueba al titular y, en cascada, a sus
  // beneficiarios (ficha académica, acceso y bienvenida). El servidor exige el permiso.
  const aprobar = async () => {
    if (!confirmar) return
    setAprobando(true)
    try {
      const r = await fetch(`/api/postgres/people/${confirmar._id}/approve`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.success === false) throw new Error(j?.error || `Error ${r.status}`)
      toast.success(`Contrato ${confirmar.contrato} aprobado`)
      setConfirmar(null)
      await cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo aprobar')
    } finally {
      setAprobando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contratos Canje</h1>
        <p className="mt-1 text-sm text-gray-600">
          Contratos pagados con compromisos publicitarios. No aparecen en el Centro de Aprobaciones: se revisan y aprueban aquí.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
        <div className="flex gap-6">
          {([['pendientes', `Pendientes (${pendientes})`], ['aprobados', 'Aprobados'], ['todos', 'Todos']] as [Pestana, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPestana(k)}
              className={`pb-2 text-sm font-medium border-b-2 -mb-px ${pestana === k ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar titular, ID o contrato"
            className="w-64 max-w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
          <button type="button" onClick={cargar} className="px-3 py-1.5 text-sm font-medium text-white bg-fuchsia-600 rounded-md hover:bg-fuchsia-700">
            Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                <th className="px-4 py-3">Titular</th>
                <th className="px-3 py-3">Contrato</th>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Valor del programa</th>
                <th className="px-3 py-3">Duración</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">
                  {pestana === 'pendientes' ? 'No hay contratos de canje pendientes de aprobación.' : 'Sin contratos para este filtro.'}
                </td></tr>
              ) : filtradas.map(c => {
                const conds = condiciones(c)
                const ver = abierto === c._id
                return (
                  <Fragment key={c._id}>
                    <tr className="hover:bg-fuchsia-50/40">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <b className="text-[13.5px] text-gray-900 uppercase">{nombre(c) || '(sin nombre)'}</b>
                          <span className="text-[11.5px] text-gray-500">
                            ID {c.numeroId}{c.plataforma ? <> · {c.plataforma}</> : null}
                            {c.asesorCreadorContrato || c.asesor ? <> · Asesor <b className="font-medium text-gray-700">{c.asesorCreadorContrato || c.asesor}</b></> : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-medium text-gray-700">{c.contrato}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-600">{fmtFecha(c.fecha)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-700">{fmtValor(c.totalPlan)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-700">{c.vigencia ? `${c.vigencia} ${Number(c.vigencia) === 1 ? 'mes' : 'meses'}` : '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex text-xs font-semibold rounded-full px-2.5 py-0.5 ${aprobado(c) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {aprobado(c) ? 'Aprobado' : (c.aprobacion?.trim() || 'Pendiente aprobación')}
                          </span>
                          <span className={`text-[10.5px] whitespace-nowrap ${c.firmado ? 'text-emerald-700' : 'text-gray-500'}`}>
                            {c.firmado ? '✓ Firmado' : 'Sin firmar'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => setAbierto(ver ? null : c._id)}
                            className="px-2.5 py-1.5 rounded-lg border border-fuchsia-300 text-fuchsia-700 text-xs font-medium hover:bg-fuchsia-50 whitespace-nowrap">
                            {ver ? 'Ocultar' : 'Condiciones'}
                          </button>
                          <a href={`/dashboard/comercial/contrato/${c._id}`} target="_blank" rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 whitespace-nowrap">
                            Ver contrato
                          </a>
                          {puedeAprobar && !aprobado(c) && (
                            <button type="button" onClick={() => setConfirmar(c)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 whitespace-nowrap">
                              ✓ Aprobar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {ver && (
                      <tr className="bg-fuchsia-50/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Condiciones del canje</div>
                              {conds.length ? (
                                <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-800">
                                  {conds.map((t, i) => <li key={i}>{t}</li>)}
                                </ol>
                              ) : <p className="text-sm text-gray-400">Sin condiciones registradas.</p>}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Usuarios</div>
                              {c.beneficiarios.length ? (
                                <ul className="space-y-1 text-sm text-gray-800">
                                  {c.beneficiarios.map(b => (
                                    <li key={b._id}>
                                      <a href={`/person/${b._id}`} target="_blank" rel="noopener noreferrer" className="text-fuchsia-700 hover:underline">{b.nombre}</a>
                                      <span className="text-gray-500"> · ID {b.numeroId}{b.kids ? ' · Kids' : ''} · {b.aprobacion || 'Pendiente'}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p className="text-sm text-gray-400">Sin beneficiarios.</p>}
                              <div className="mt-3 text-xs text-gray-500">
                                Contacto: {c.celular || '—'} · {c.email || '—'}<br />
                                Final del contrato: {fmtFecha(c.finalContrato)}{c.fechaIngreso ? <> · Aprobado el {fmtFecha(c.fechaIngreso)}</> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Aprobar contrato de canje</h2>
              <p className="text-emerald-50 text-xs mt-0.5">{confirmar.contrato} · {nombre(confirmar)}</p>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm text-gray-700">
              {!confirmar.firmado && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
                  ⚠️ El titular todavía <b>no ha firmado</b> el contrato.
                </div>
              )}
              <p>
                Se aprueban el titular y sus {confirmar.beneficiarios.length} usuario(s): se crea su ficha académica y su acceso, y reciben el mensaje de bienvenida.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(null)} disabled={aprobando}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={aprobar} disabled={aprobando}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                {aprobando ? 'Aprobando…' : 'Aprobar contrato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ContratosCanjePage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={AprobacionPermission.CONTRATOS_CANJE_VER} showDefaultMessage>
        <ContratosCanje />
      </PermissionGuard>
    </DashboardLayout>
  )
}
