'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ServicioPermission } from '@/types/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { api, handleApiError } from '@/hooks/use-api'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Prueba = 'IELTS' | 'TOEFL' | 'B2FIRST'
const PRUEBAS: Prueba[] = ['IELTS', 'TOEFL', 'B2FIRST']
const PRUEBA_LABEL: Record<Prueba, string> = { IELTS: 'IELTS', TOEFL: 'TOEFL', B2FIRST: 'B2 First' }

// Días con la convención JS getDay(): 0=Dom … 6=Sáb.
const DIAS: { n: number; label: string }[] = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mié' },
  { n: 4, label: 'Jue' }, { n: 5, label: 'Vie' }, { n: 6, label: 'Sáb' }, { n: 0, label: 'Dom' },
]

interface FranjaForm { dias: number[]; hora: string; advisor: string; linkZoom: string; cupo: string }
type ConfigForm = Record<Prueba, FranjaForm[]>
interface CicloForm { _id?: string; nombre: string; fechaInicial: string; fechaFinal: string; config: ConfigForm }

interface CicloRow {
  _id: string; nombre: string; fechaInicial: string; fechaFinal: string
  config: Partial<Record<Prueba, FranjaForm[]>>; estado: string; eventosGenerados: number
}
interface Advisor { _id: string; nombreCompleto?: string; primerNombre?: string; primerApellido?: string; zoom?: string; activo?: boolean }
interface AgrupacionRow {
  studentId: string; numeroId: string | null; primerNombre: string | null; primerApellido: string | null
  email: string | null; celular: string | null; plataforma: string | null; programas: string[]
}
interface CursoRow {
  examen: string; advisores: string; totalEventos: number; franjas: number; inscritos: number
}
type Estado = 'CONFIRMADO' | 'PENDIENTE' | 'CANCELADO'
interface RosterRow {
  studentId: string; primerNombre: string | null; primerApellido: string | null
  numeroId: string | null; celular: string | null; estado: Estado
}

const emptyFranja = (): FranjaForm => ({ dias: [], hora: '', advisor: '', linkZoom: '', cupo: '30' })
const emptyConfig = (): ConfigForm => ({ IELTS: [], TOEFL: [], B2FIRST: [] })
const emptyForm = (): CicloForm => ({ nombre: '', fechaInicial: '', fechaFinal: '', config: emptyConfig() })

function advisorName(a: Advisor): string {
  return (a.nombreCompleto || `${a.primerNombre || ''} ${a.primerApellido || ''}`).trim() || a._id
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function SetupCicloPage() {
  const { hasPermission, isRole } = usePermissions()
  const hasFullAccess = isRole('SUPER_ADMIN') || isRole('ADMIN')
  const canGenerar = hasFullAccess || hasPermission(ServicioPermission.EXAM_INTERN_SETUP_GENERAR)
  const canAgendar = hasFullAccess || hasPermission(ServicioPermission.EXAM_INTERN_AGRUPACION_AGENDAR)

  const [tab, setTab] = useState<'setup' | 'agrupacion'>('setup')
  const [ciclos, setCiclos] = useState<CicloRow[]>([])
  const [advisors, setAdvisors] = useState<Advisor[]>([])

  const loadCiclos = useCallback(async () => {
    try {
      const data = await api.get<{ ciclos: CicloRow[] }>('/api/postgres/servicio/exam-ciclo')
      setCiclos(Array.isArray(data.ciclos) ? data.ciclos : [])
    } catch (e) { handleApiError(e, 'Error al cargar ciclos') }
  }, [])

  const loadAdvisors = useCallback(async () => {
    try {
      const data = await api.get<{ advisors: Advisor[] }>('/api/postgres/advisors')
      setAdvisors((Array.isArray(data.advisors) ? data.advisors : []).filter(a => a.activo !== false))
    } catch { /* no bloquea la pantalla */ }
  }, [])

  useEffect(() => { loadCiclos(); loadAdvisors() }, [loadCiclos, loadAdvisors])

  return (
    <DashboardLayout>
      <PermissionGuard permission={ServicioPermission.EXAM_INTERN_SETUP_VER}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗓️ Exam. Intern. — SetUp Ciclo y Agrupación</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configura el ciclo de exámenes internacionales, genera los eventos y agrupa a los estudiantes confirmados.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {([['setup', '1 · SetUp Ciclo'], ['agrupacion', '2 · Agrupación / Inscripción']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === k ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'setup' ? (
            <SetupTab
              ciclos={ciclos}
              advisors={advisors}
              canGenerar={canGenerar}
              reload={loadCiclos}
            />
          ) : (
            <AgrupacionTab
              ciclos={ciclos}
              canAgendar={canAgendar}
            />
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}

// ── Pestaña 1: SetUp Ciclo ─────────────────────────────────────────────────

function SetupTab({ ciclos, advisors, canGenerar, reload }: {
  ciclos: CicloRow[]; advisors: Advisor[]; canGenerar: boolean; reload: () => Promise<void>
}) {
  const [form, setForm] = useState<CicloForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [generando, setGenerando] = useState<string | null>(null)

  const isEditing = !!form._id

  const startNew = () => setForm(emptyForm())
  const startEdit = (c: CicloRow) => {
    const cfg = emptyConfig()
    for (const p of PRUEBAS) {
      cfg[p] = (c.config?.[p] || []).map(f => ({
        dias: Array.isArray(f.dias) ? f.dias : [],
        hora: f.hora || '',
        advisor: (f as any).advisor || '',
        linkZoom: (f as any).linkZoom || '',
        cupo: String((f as any).cupo ?? 30),
      }))
    }
    setForm({ _id: c._id, nombre: c.nombre, fechaInicial: c.fechaInicial, fechaFinal: c.fechaFinal, config: cfg })
  }

  const setFranjas = (p: Prueba, franjas: FranjaForm[]) =>
    setForm(f => ({ ...f, config: { ...f.config, [p]: franjas } }))

  const addFranja = (p: Prueba) => setFranjas(p, [...form.config[p], emptyFranja()])
  const removeFranja = (p: Prueba, idx: number) => setFranjas(p, form.config[p].filter((_, i) => i !== idx))
  const updateFranja = (p: Prueba, idx: number, patch: Partial<FranjaForm>) =>
    setFranjas(p, form.config[p].map((fr, i) => (i === idx ? { ...fr, ...patch } : fr)))
  const toggleDia = (p: Prueba, idx: number, dia: number) => {
    const fr = form.config[p][idx]
    const dias = fr.dias.includes(dia) ? fr.dias.filter(d => d !== dia) : [...fr.dias, dia]
    updateFranja(p, idx, { dias })
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre del ciclo es requerido'); return }
    if (!form.fechaInicial || !form.fechaFinal) { toast.error('Selecciona el rango de fechas'); return }
    if (form.fechaFinal < form.fechaInicial) { toast.error('La fecha final no puede ser anterior a la inicial'); return }
    setSaving(true)
    try {
      await api.post('/api/postgres/servicio/exam-ciclo', form)
      toast.success(isEditing ? 'Ciclo actualizado' : 'Ciclo creado')
      setForm(emptyForm())
      await reload()
    } catch (e) { handleApiError(e, 'Error al guardar el ciclo') }
    finally { setSaving(false) }
  }

  const handleGenerar = async (c: CicloRow) => {
    if (!window.confirm(
      `Vas a generar los eventos de examen del ciclo "${c.nombre}" (${c.fechaInicial} → ${c.fechaFinal}).\n\n` +
      `Esta acción crea las sesiones en el calendario y no se puede repetir. ¿Continuar?`
    )) return
    setGenerando(c._id)
    try {
      const data = await api.post<{ generados: number; message: string }>(`/api/postgres/servicio/exam-ciclo/${c._id}/generar`)
      toast.success(data.message || `${data.generados} eventos generados`, { duration: 6000 })
      await reload()
    } catch (e) { handleApiError(e, 'Error al generar eventos') }
    finally { setGenerando(null) }
  }

  return (
    <div className="space-y-6">
      {/* Lista de ciclos */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ciclos</h2>
          <button type="button" onClick={startNew}
            className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700">
            + Nuevo ciclo
          </button>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Nombre</th>
                  <th className="table-header-cell">Rango</th>
                  <th className="table-header-cell text-center">Estado</th>
                  <th className="table-header-cell text-center">Eventos</th>
                  <th className="table-header-cell text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {ciclos.length > 0 ? ciclos.map(c => (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-gray-900">{c.nombre}</td>
                    <td className="table-cell text-sm text-gray-600">{c.fechaInicial} → {c.fechaFinal}</td>
                    <td className="table-cell text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.estado === 'GENERADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>{c.estado}</span>
                    </td>
                    <td className="table-cell text-center text-sm">{c.eventosGenerados || 0}</td>
                    <td className="table-cell text-right space-x-2">
                      {c.estado !== 'GENERADO' && (
                        <button type="button" onClick={() => startEdit(c)}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                          Editar
                        </button>
                      )}
                      {canGenerar && c.estado !== 'GENERADO' && (
                        <button type="button" onClick={() => handleGenerar(c)} disabled={generando === c._id}
                          className="px-2 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">
                          {generando === c._id ? 'Generando…' : 'Generar eventos'}
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center py-6 text-sm text-gray-500">No hay ciclos. Crea uno abajo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Formulario de ciclo */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Editar ciclo: ${form.nombre || '(sin nombre)'}` : 'Nuevo ciclo'}
          </h2>
        </div>
        <div className="card-content space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del ciclo *</label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Octubre2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicial *</label>
              <input type="date" value={form.fechaInicial} onChange={e => setForm(f => ({ ...f, fechaInicial: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha final *</label>
              <input type="date" value={form.fechaFinal} onChange={e => setForm(f => ({ ...f, fechaFinal: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500" />
            </div>
          </div>

          {PRUEBAS.map(p => (
            <div key={p} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{PRUEBA_LABEL[p]}</span>
                <button type="button" onClick={() => addFranja(p)}
                  className="text-xs font-medium text-purple-700 hover:text-purple-900">+ Agregar franja</button>
              </div>
              <div className="p-3 space-y-3">
                {form.config[p].length === 0 && (
                  <p className="text-xs text-gray-400">Sin franjas. Agrega una para incluir {PRUEBA_LABEL[p]} en el ciclo.</p>
                )}
                {form.config[p].map((fr, idx) => (
                  <div key={idx} className="rounded-md border border-gray-200 p-3 space-y-3 bg-white">
                    <div className="flex flex-wrap items-center gap-1">
                      {DIAS.map(d => (
                        <button key={d.n} type="button" onClick={() => toggleDia(p, idx, d.n)}
                          className={`px-2 py-1 text-xs font-medium rounded border ${
                            fr.dias.includes(d.n)
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}>{d.label}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Hora</label>
                        <input type="time" value={fr.hora} onChange={e => updateFranja(p, idx, { hora: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Advisor</label>
                        <select value={fr.advisor}
                          onChange={e => {
                            const adv = advisors.find(a => a._id === e.target.value)
                            updateFranja(p, idx, { advisor: e.target.value, linkZoom: fr.linkZoom || adv?.zoom || '' })
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                          <option value="">Seleccionar…</option>
                          {advisors.map(a => <option key={a._id} value={a._id}>{advisorName(a)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Link Zoom</label>
                        <input type="text" value={fr.linkZoom} onChange={e => updateFranja(p, idx, { linkZoom: e.target.value })}
                          placeholder="https://zoom.us/…"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cupo</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} value={fr.cupo} onChange={e => updateFranja(p, idx, { cupo: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                          <button type="button" onClick={() => removeFranja(p, idx)}
                            className="px-2 py-1.5 text-xs text-red-600 hover:text-red-800 whitespace-nowrap">Quitar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-3">
            {isEditing && (
              <button type="button" onClick={startNew}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancelar edición
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50">
              {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear ciclo'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Para generar los eventos, guarda el ciclo y luego pulsa <strong>Generar eventos</strong> en la tabla de arriba.
            Un ciclo ya generado no se puede editar ni regenerar.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Pestaña 2: Agrupación / Inscripción ────────────────────────────────────

function AgrupacionTab({ ciclos, canAgendar }: { ciclos: CicloRow[]; canAgendar: boolean }) {
  const generados = useMemo(() => ciclos.filter(c => c.estado === 'GENERADO'), [ciclos])
  const [cicloId, setCicloId] = useState('')
  const [cursos, setCursos] = useState<CursoRow[]>([])
  const [examen, setExamen] = useState('')   // curso seleccionado = examen (IELTS/TOEFL/B2FIRST)

  const [search, setSearch] = useState('')
  const [pool, setPool] = useState<AgrupacionRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingPool, setLoadingPool] = useState(false)

  const [roster, setRoster] = useState<RosterRow[]>([])
  const [busy, setBusy] = useState(false)

  // Ciclo por defecto = primer ciclo generado.
  useEffect(() => {
    if (!cicloId && generados.length > 0) setCicloId(generados[0]._id)
  }, [generados, cicloId])

  const loadCursos = useCallback(async () => {
    if (!cicloId) { setCursos([]); return }
    try {
      const d = await api.get<{ cursos: CursoRow[] }>(`/api/postgres/servicio/exam-agrupacion/cursos?cicloId=${encodeURIComponent(cicloId)}`)
      setCursos(Array.isArray(d.cursos) ? d.cursos : [])
    } catch (e) { handleApiError(e, 'Error al cargar cursos') }
  }, [cicloId])

  // Cargar cursos del ciclo (y resetear el curso elegido al cambiar de ciclo).
  useEffect(() => { setExamen(''); loadCursos() }, [cicloId, loadCursos])

  const loadPool = useCallback(async () => {
    setLoadingPool(true)
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      const d = await api.get<{ estudiantes: AgrupacionRow[] }>(`/api/postgres/servicio/exam-agrupacion${qs}`)
      setPool(Array.isArray(d.estudiantes) ? d.estudiantes : [])
      setSelected(new Set())
    } catch (e) { handleApiError(e, 'Error al cargar estudiantes') }
    finally { setLoadingPool(false) }
  }, [search])

  useEffect(() => { loadPool() }, [loadPool])

  const loadRoster = useCallback(async () => {
    if (!cicloId || !examen) { setRoster([]); return }
    try {
      const d = await api.get<{ inscritos: RosterRow[] }>(
        `/api/postgres/servicio/exam-agrupacion/roster?cicloId=${encodeURIComponent(cicloId)}&examen=${encodeURIComponent(examen)}`
      )
      setRoster(Array.isArray(d.inscritos) ? d.inscritos : [])
    } catch (e) { handleApiError(e, 'Error al cargar inscritos') }
  }, [cicloId, examen])

  useEffect(() => { loadRoster() }, [loadRoster])

  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const allSelected = pool.length > 0 && pool.every(s => selected.has(s.studentId))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pool.map(s => s.studentId)))

  const cursoLabel = (c: CursoRow) =>
    `${c.examen}${c.advisores ? ` — ${c.advisores}` : ''} · ${c.totalEventos} sesiones · ${c.franjas} franja${c.franjas !== 1 ? 's' : ''} · ${c.inscritos} inscritos`

  const handleAgendar = async () => {
    if (!examen) { toast.error('Selecciona el curso al que agendar'); return }
    if (selected.size === 0) { toast.error('Selecciona al menos un estudiante'); return }
    setBusy(true)
    try {
      const d = await api.post<{ enrolled: number; eventos: number; message: string }>('/api/postgres/servicio/exam-agrupacion/agendar', {
        cicloId, examen, studentIds: Array.from(selected),
      })
      toast.success(d.message || `${d.enrolled} agendado(s)`)
      setSelected(new Set())
      await Promise.all([loadRoster(), loadCursos()])
    } catch (e) { handleApiError(e, 'Error al agendar') }
    finally { setBusy(false) }
  }

  const handleEstado = async (studentId: string, estado: Estado) => {
    if (!examen) return
    setBusy(true)
    try {
      await api.post('/api/postgres/servicio/exam-agrupacion/estado', { cicloId, examen, studentId, estado })
      await Promise.all([loadRoster(), loadCursos()])
    } catch (e) { handleApiError(e, 'Error al cambiar estado') }
    finally { setBusy(false) }
  }

  const counts = useMemo(() => ({
    confirmados: roster.filter(r => r.estado === 'CONFIRMADO').length,
    cancelados: roster.filter(r => r.estado === 'CANCELADO').length,
    pendientes: roster.filter(r => r.estado === 'PENDIENTE').length,
  }), [roster])

  const estadoBadge = (e: Estado) => e === 'CONFIRMADO'
    ? 'bg-emerald-100 text-emerald-800' : e === 'CANCELADO'
    ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'

  return (
    <div className="space-y-6">
      {/* Selectores de ciclo + evento */}
      <div className="card">
        <div className="card-content grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciclo</label>
            <select value={cicloId} onChange={e => setCicloId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">Selecciona un ciclo…</option>
              {generados.map(c => <option key={c._id} value={c._id}>{c.nombre} ({c.fechaInicial} → {c.fechaFinal})</option>)}
            </select>
            {generados.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No hay ciclos generados. Genera uno en la pestaña SetUp Ciclo.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Curso (examen)</label>
            <select value={examen} onChange={e => setExamen(e.target.value)} disabled={!cicloId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100">
              <option value="">Selecciona un curso…</option>
              {cursos.map(c => <option key={c.examen} value={c.examen}>{cursoLabel(c)}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Agendar inscribe al estudiante en TODA la serie del curso (todas las franjas y fechas).</p>
          </div>
        </div>
      </div>

      {/* Pool de confirmados */}
      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Estudiantes confirmados</h2>
          <div className="flex items-center gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar apellido o ID…"
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
            {canAgendar && (
              <button type="button" onClick={handleAgendar} disabled={busy || selected.size === 0 || !examen}
                className="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50">
                Agendar al curso ({selected.size})
              </button>
            )}
          </div>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  {canAgendar && (
                    <th className="table-header-cell text-center w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    </th>
                  )}
                  <th className="table-header-cell">Nombre</th>
                  <th className="table-header-cell">Programa(s)</th>
                  <th className="table-header-cell">Celular</th>
                  <th className="table-header-cell">Plataforma</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {pool.length > 0 ? pool.map(s => {
                  const colision = (s.programas || []).length > 1
                  return (
                    <tr key={s.studentId} className="hover:bg-gray-50">
                      {canAgendar && (
                        <td className="table-cell text-center">
                          <input type="checkbox" checked={selected.has(s.studentId)} onChange={() => toggleOne(s.studentId)}
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                        </td>
                      )}
                      <td className="table-cell">
                        <div className="text-sm font-medium text-gray-900">
                          {[s.primerNombre, s.primerApellido].filter(Boolean).join(' ') || 'Sin nombre'}
                        </div>
                        {s.numeroId && <div className="text-xs text-gray-500">ID: {s.numeroId}</div>}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(s.programas || []).map(pr => (
                            <span key={pr} className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{pr}</span>
                          ))}
                          {colision && (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800" title="Colisión: en más de un programa">⚠ colisión</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-sm text-gray-500">{s.celular || 'N/A'}</td>
                      <td className="table-cell text-sm text-gray-500">{s.plataforma || 'N/A'}</td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={canAgendar ? 5 : 4} className="text-center py-6 text-sm text-gray-500">
                    {loadingPool ? 'Cargando…' : 'No hay estudiantes confirmados.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Roster del evento */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Inscritos del curso</h2>
          {examen ? (
            <p className="text-sm text-gray-500 mt-1">
              ✅ {counts.confirmados} confirmado(s) · ✗ {counts.cancelados} cancelado(s) · • {counts.pendientes} pendiente(s)
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Selecciona un curso para ver y gestionar sus inscritos.</p>
          )}
        </div>
        <div className="card-content">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Nombre</th>
                  <th className="table-header-cell">Celular</th>
                  <th className="table-header-cell text-center">Estado</th>
                  {canAgendar && <th className="table-header-cell text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="table-body">
                {roster.length > 0 ? roster.map(r => (
                  <tr key={r.studentId} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="text-sm font-medium text-gray-900">
                        {[r.primerNombre, r.primerApellido].filter(Boolean).join(' ') || 'Sin nombre'}
                      </div>
                      {r.numeroId && <div className="text-xs text-gray-500">ID: {r.numeroId}</div>}
                    </td>
                    <td className="table-cell text-sm text-gray-500">{r.celular || 'N/A'}</td>
                    <td className="table-cell text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(r.estado)}`}>{r.estado}</span>
                    </td>
                    {canAgendar && (
                      <td className="table-cell text-right space-x-1">
                        <button type="button" disabled={busy || r.estado === 'CONFIRMADO'} onClick={() => handleEstado(r.studentId, 'CONFIRMADO')}
                          className="px-2 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-40">Confirmar</button>
                        <button type="button" disabled={busy || r.estado === 'CANCELADO'} onClick={() => handleEstado(r.studentId, 'CANCELADO')}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-40">Cancelar</button>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr><td colSpan={canAgendar ? 4 : 3} className="text-center py-6 text-sm text-gray-500">
                    {examen ? 'Sin inscritos en este curso.' : '—'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
