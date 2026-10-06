'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { RecaudosPermission } from '@/types/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { exportToExcel } from '@/lib/export-excel'
import { ChevronDown, ChevronRight, ChevronLeft, Download, Filter, Lock, Unlock, AlertTriangle } from 'lucide-react'

interface Mora {
  diaCorte: number
  cuotasVencidas: number
  cuotasRegistradas: number
  cuotasAtrasadas: number
  fechaPrimeraImpaga: string | null
  diasMora: number
}
interface Desbloqueo { _id: string; motivo: string; desbloqueadoPor: string | null; desbloqueadoPorNombre: string | null; fecha: string }
interface UsuarioMora {
  titularId: string
  titular: string
  numeroId: string
  contrato: string
  plataforma: string | null
  finalContrato: string | null
  estadoContrato: 'VIGENTE' | 'ONHOLD' | 'FINALIZADO' | 'INACTIVO'
  celular: string | null
  email: string | null
  gestorRecaudo: string | null
  gestorNombre: string | null
  mora: Mora
  valorCuota: number | null
  valorAtrasado: number | null
  desbloqueo: Desbloqueo | null
}
interface Beneficiario {
  _id: string
  nombre: string
  numeroId: string
  kids: boolean
  activo: boolean
  onHold: boolean
  academicaId: string | null
  nivel: string | null
  step: string | null
  niveles: Record<'beginner' | 'practical' | 'functional', { aprobado: boolean; fecha: string | null }> | null
}

const PAGE = 25
const fmtFecha = (v: string | null) => {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const fmtValor = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`)
const ESTADO_META: Record<UsuarioMora['estadoContrato'], { label: string; cls: string }> = {
  VIGENTE:    { label: 'Vigente',    cls: 'bg-green-100 text-green-800' },
  ONHOLD:     { label: 'OnHold',     cls: 'bg-amber-100 text-amber-800' },
  FINALIZADO: { label: 'Finalizado', cls: 'bg-gray-200 text-gray-700' },
  INACTIVO:   { label: 'Inactivo',   cls: 'bg-red-100 text-red-800' },
}
const NIVELES_CERT: { key: 'beginner' | 'practical' | 'functional'; label: string; cls: string }[] = [
  { key: 'beginner',   label: 'Beginner',   cls: 'bg-yellow-100 text-yellow-900' },
  { key: 'practical',  label: 'Practical',  cls: 'bg-red-100 text-red-800' },
  { key: 'functional', label: 'Functional', cls: 'bg-blue-100 text-blue-800' },
]

function Beneficiarios({ contrato }: { contrato: string }) {
  const [data, setData] = useState<Beneficiario[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    fetch(`/api/postgres/recaudos/usuarios-mora/${encodeURIComponent(contrato)}`)
      .then(r => r.json())
      .then(j => { if (alive) j?.success ? setData(j.beneficiarios || []) : setError(j?.error || 'Error al cargar') })
      .catch(() => alive && setError('Error al cargar beneficiarios'))
    return () => { alive = false }
  }, [contrato])

  if (error) return <p className="text-sm text-red-600 px-4 py-3">{error}</p>
  if (!data) return <p className="text-sm text-gray-400 italic px-4 py-3">Cargando beneficiarios…</p>
  if (data.length === 0) return <p className="text-sm text-gray-400 italic px-4 py-3">El contrato no tiene beneficiarios.</p>
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500">
          <th className="px-4 py-2 font-medium">Beneficiario</th>
          <th className="px-4 py-2 font-medium">Documento</th>
          <th className="px-4 py-2 font-medium">Nivel actual</th>
          <th className="px-4 py-2 font-medium">Niveles aprobados</th>
          <th className="px-4 py-2 font-medium">Activo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.map(b => (
          <tr key={b._id}>
            <td className="px-4 py-2">
              <a href={b.academicaId ? `/student/${b.academicaId}` : `/person/${b._id}`} target="_blank" rel="noopener noreferrer"
                className="text-blue-700 hover:underline">{b.nombre}</a>
              {b.kids && <span className="ml-2 badge bg-purple-100 text-purple-700">KIDS</span>}
            </td>
            <td className="px-4 py-2 text-gray-700">{b.numeroId}</td>
            <td className="px-4 py-2 text-gray-700">
              {b.nivel ? `${b.nivel}${b.step ? ` · ${b.step}` : ''}` : <span className="text-gray-400">{b.kids ? 'Programa Kids' : 'Sin ficha académica'}</span>}
            </td>
            <td className="px-4 py-2">
              {!b.niveles ? <span className="text-gray-400">—</span> : (
                <div className="flex flex-wrap gap-1">
                  {NIVELES_CERT.filter(n => b.niveles?.[n.key]?.aprobado).map(n => (
                    <span key={n.key} className={`badge ${n.cls}`} title={`Aprobado el ${fmtFecha(b.niveles?.[n.key]?.fecha ?? null)}`}>{n.label}</span>
                  ))}
                  {!NIVELES_CERT.some(n => b.niveles?.[n.key]?.aprobado) && <span className="text-gray-400">Ninguno</span>}
                </div>
              )}
            </td>
            <td className="px-4 py-2">
              {b.onHold ? <span className="badge bg-amber-100 text-amber-800">OnHold</span>
                : b.activo ? <span className="badge bg-green-100 text-green-800">Sí</span>
                : <span className="badge bg-red-100 text-red-800">No</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function UsuariosMoraPage() {
  const { hasPermission } = usePermissions()
  const canUnlock = hasPermission(RecaudosPermission.USUARIOS_MORA_DESBLOQUEAR)

  const [usuarios, setUsuarios] = useState<UsuarioMora[]>([])
  const [bloqueoActivo, setBloqueoActivo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [estado, setEstado] = useState('')
  const [cert, setCert] = useState('')
  const [gestor, setGestor] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [desbloquear, setDesbloquear] = useState<UsuarioMora | null>(null)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/postgres/recaudos/usuarios-mora')
      const j = await res.json()
      if (!j?.success) throw new Error(j?.error || 'Error al cargar')
      setUsuarios(j.usuarios || [])
      setBloqueoActivo(!!j.bloqueoActivo)
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cargar el informe')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const plataformas = useMemo(() => Array.from(new Set(usuarios.map(u => u.plataforma).filter(Boolean))).sort() as string[], [usuarios])
  // Gestores presentes en el informe (id → nombre), ordenados por nombre.
  const gestores = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of usuarios) if (u.gestorRecaudo) m.set(u.gestorRecaudo, u.gestorNombre || 'Gestor sin nombre')
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [usuarios])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return usuarios.filter(u =>
      (!q || u.titular.toLowerCase().includes(q) || String(u.numeroId || '').toLowerCase().includes(q) || u.contrato.toLowerCase().includes(q)) &&
      (!plataforma || u.plataforma === plataforma) &&
      (!estado || u.estadoContrato === estado) &&
      (!gestor || (gestor === '__SIN__' ? !u.gestorRecaudo : u.gestorRecaudo === gestor)) &&
      (!cert || (cert === 'DESBLOQUEADO' ? !!u.desbloqueo : !u.desbloqueo)))
  }, [usuarios, search, plataforma, estado, gestor, cert])
  useEffect(() => { setPage(1) }, [search, plataforma, estado, gestor, cert])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE)
  const totalAtrasado = filtered.reduce((s, u) => s + (u.valorAtrasado || 0), 0)

  const toggle = (contrato: string) => setExpanded(prev => {
    const s = new Set(prev)
    s.has(contrato) ? s.delete(contrato) : s.add(contrato)
    return s
  })

  const confirmarDesbloqueo = async () => {
    if (!desbloquear || motivo.trim().length < 10) return
    setSaving(true)
    try {
      const res = await fetch(`/api/postgres/recaudos/usuarios-mora/${encodeURIComponent(desbloquear.contrato)}/desbloqueo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: motivo.trim() }),
      })
      const j = await res.json()
      if (!j?.success) throw new Error(j?.error || 'No se pudo desbloquear')
      setUsuarios(prev => prev.map(u => u.contrato === desbloquear.contrato ? { ...u, desbloqueo: j.desbloqueo } : u))
      toast.success(`Certificado desbloqueado para ${desbloquear.contrato}`)
      setDesbloquear(null); setMotivo('')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo desbloquear')
    } finally {
      setSaving(false)
    }
  }

  const revocar = async (u: UsuarioMora) => {
    if (!window.confirm(`¿Revocar el desbloqueo del contrato ${u.contrato}? Sus beneficiarios volverán a quedar bloqueados mientras esté en mora.`)) return
    try {
      const res = await fetch(`/api/postgres/recaudos/usuarios-mora/${encodeURIComponent(u.contrato)}/desbloqueo`, { method: 'DELETE' })
      const j = await res.json()
      if (!j?.success) throw new Error(j?.error || 'No se pudo revocar')
      setUsuarios(prev => prev.map(x => x.contrato === u.contrato ? { ...x, desbloqueo: null } : x))
      toast.success('Desbloqueo revocado')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo revocar')
    }
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={RecaudosPermission.USUARIOS_MORA_VER} showDefaultMessage>
        <div className="space-y-6">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">⚠️ Usuarios en mora</h1>
              <p className="mt-2 text-sm text-gray-700">
                Titulares aprobados con cuotas vencidas sin registrar (misma regla del indicador "En mora" de la ficha financiera).
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" disabled={filtered.length === 0}
                onClick={() => exportToExcel(filtered, [
                  { header: 'Titular', accessor: (u) => u.titular },
                  { header: 'Documento', accessor: (u) => u.numeroId },
                  { header: 'Contrato', accessor: (u) => u.contrato },
                  { header: 'Plataforma', accessor: (u) => u.plataforma || '' },
                  { header: 'Final Contrato', accessor: (u) => fmtFecha(u.finalContrato) },
                  { header: 'Estado Contrato', accessor: (u) => ESTADO_META[u.estadoContrato].label },
                  { header: 'Gestor de Recaudo', accessor: (u) => u.gestorNombre || 'Sin asignar' },
                  { header: 'Celular', accessor: (u) => u.celular || '' },
                  { header: 'Email', accessor: (u) => u.email || '' },
                  { header: 'Día de corte', accessor: (u) => u.mora.diaCorte },
                  { header: 'Cuotas vencidas', accessor: (u) => u.mora.cuotasVencidas },
                  { header: 'Cuotas registradas', accessor: (u) => u.mora.cuotasRegistradas },
                  { header: 'Cuotas atrasadas', accessor: (u) => u.mora.cuotasAtrasadas },
                  { header: 'En mora desde', accessor: (u) => fmtFecha(u.mora.fechaPrimeraImpaga) },
                  { header: 'Días de mora', accessor: (u) => u.mora.diasMora },
                  { header: 'Valor atrasado aprox.', accessor: (u) => u.valorAtrasado ?? '' },
                  { header: 'Certificado', accessor: (u) => u.desbloqueo ? 'Desbloqueado' : 'Bloqueado' },
                  { header: 'Motivo desbloqueo', accessor: (u) => u.desbloqueo?.motivo || '' },
                ], `usuarios-en-mora-${new Date().toISOString().split('T')[0]}`)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" /> Exportar Excel
              </button>
              <button type="button" onClick={() => load()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Filter className="w-4 h-4" /> Actualizar
              </button>
            </div>
          </div>

          <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${bloqueoActivo ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {bloqueoActivo
                ? 'El bloqueo de certificados por mora está ACTIVO: los beneficiarios de estos contratos no pueden generar su certificado salvo que el contrato esté desbloqueado.'
                : 'El bloqueo de certificados por mora está APAGADO (Mantenimiento › Bloqueo Certificados por Mora). Los pagos de cuotas se registran desde mayo de 2026: muchos contratos anteriores aparecen aquí sin estar en mora.'}
            </span>
          </div>

          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <input type="text" placeholder="Nombre, documento o contrato..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Gestor de recaudo</label>
                <select value={gestor} onChange={(e) => setGestor(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Todos</option>
                  <option value="__SIN__">Sin asignar</option>
                  {gestores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Todas</option>
                  {plataformas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado del contrato</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Certificado</label>
                <select value={cert} onChange={(e) => setCert(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Todos</option>
                  <option value="BLOQUEADO">Bloqueados</option>
                  <option value="DESBLOQUEADO">Desbloqueados</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-semibold">
              {filtered.length} contrato{filtered.length === 1 ? '' : 's'} en mora
              <span className="ml-2 text-sm font-normal text-gray-500">· valor atrasado aprox. {fmtValor(totalAtrasado)}</span>
            </h2>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 py-1 text-sm">{page} de {totalPages}</span>
                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            {loading ? (
              <p className="p-6 text-center text-gray-500">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-gray-500">No hay contratos en mora con estos filtros.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-3 py-3 w-8"></th>
                    <th className="px-3 py-3">Titular</th>
                    <th className="px-3 py-3">Documento</th>
                    <th className="px-3 py-3">Contrato</th>
                    <th className="px-3 py-3">Final contrato</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Gestor</th>
                    <th className="px-3 py-3 text-center">Cuotas atrasadas</th>
                    <th className="px-3 py-3 text-center">Días mora</th>
                    <th className="px-3 py-3 text-right">Valor aprox.</th>
                    <th className="px-3 py-3">Certificado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageRows.map(u => {
                    const open = expanded.has(u.contrato)
                    return (
                      <Fragment key={u.contrato}>
                        <tr className={open ? 'bg-blue-50/40' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => toggle(u.contrato)} title={open ? 'Ocultar beneficiarios' : 'Ver beneficiarios'}
                              className="text-gray-500 hover:text-gray-800">
                              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <a href={`/person/${u.titularId}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium">{u.titular}</a>
                            {u.plataforma && <div className="text-xs text-gray-400">{u.plataforma}</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{u.numeroId}</td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{u.contrato}</td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtFecha(u.finalContrato)}</td>
                          <td className="px-3 py-2"><span className={`badge ${ESTADO_META[u.estadoContrato].cls}`}>{ESTADO_META[u.estadoContrato].label}</span></td>
                          <td className="px-3 py-2 text-gray-700">{u.gestorNombre || <span className="text-gray-400 italic">Sin asignar</span>}</td>
                          <td className="px-3 py-2 text-center" title={`Vencidas ${u.mora.cuotasVencidas} · registradas ${u.mora.cuotasRegistradas} · corte día ${u.mora.diaCorte}`}>
                            <span className="font-semibold text-red-700">{u.mora.cuotasAtrasadas}</span>
                            <span className="text-xs text-gray-400"> / {u.mora.cuotasVencidas}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-700" title={`En mora desde ${fmtFecha(u.mora.fechaPrimeraImpaga)}`}>{u.mora.diasMora}</td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{fmtValor(u.valorAtrasado)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {u.desbloqueo ? (
                              <div className="flex items-center gap-2">
                                <span className="badge bg-green-100 text-green-800" title={`${u.desbloqueo.motivo} — ${u.desbloqueo.desbloqueadoPorNombre || u.desbloqueo.desbloqueadoPor || ''} · ${fmtFecha(u.desbloqueo.fecha)}`}>
                                  <Unlock className="w-3 h-3 inline mr-1" />Desbloqueado
                                </span>
                                {canUnlock && (
                                  <button type="button" onClick={() => revocar(u)} className="text-xs text-red-600 hover:underline">Revocar</button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="badge bg-red-100 text-red-800"><Lock className="w-3 h-3 inline mr-1" />Bloqueado</span>
                                {canUnlock && (
                                  <button type="button" onClick={() => { setDesbloquear(u); setMotivo('') }}
                                    className="px-2 py-1 text-xs border border-green-600 text-green-700 rounded hover:bg-green-600 hover:text-white transition-colors">
                                    Desbloquear
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td></td>
                            <td colSpan={10} className="bg-gray-50 border-l-4 border-blue-300">
                              <Beneficiarios contrato={u.contrato} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {desbloquear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Unlock className="w-5 h-5 text-green-600" /> Desbloquear certificado
              </h3>
              <p className="text-sm text-gray-700">
                Contrato <strong>{desbloquear.contrato}</strong> — {desbloquear.titular}. Todos sus beneficiarios podrán generar el
                certificado aunque el contrato siga en mora ({desbloquear.mora.cuotasAtrasadas} cuota{desbloquear.mora.cuotasAtrasadas === 1 ? '' : 's'} atrasada{desbloquear.mora.cuotasAtrasadas === 1 ? '' : 's'}).
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (obligatorio)</label>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                  placeholder="Ej: pagos al día verificados en banco, pendientes de registrar"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Mínimo 10 caracteres. Queda registrado con su usuario y la fecha.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDesbloquear(null)} disabled={saving}
                  className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Cancelar</button>
                <button type="button" onClick={confirmarDesbloqueo} disabled={saving || motivo.trim().length < 10}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Desbloqueando…' : 'Desbloquear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </PermissionGuard>
    </DashboardLayout>
  )
}
