'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowPathIcon, ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon, FaceSmileIcon,
} from '@heroicons/react/24/outline'
import { exportToExcel } from '@/lib/export-excel'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { cursoColorCls } from '@/components/comercial/KidsCursoTexto'
import { PermissionGuard } from '@/components/permissions'
import { AprobacionPermission } from '@/types/permissions'

interface Slot { tipo: string; diaSemana: number; horaLocal: string; duracionMin: number }
interface Inscrito {
  ref: string; grupo: 'ACTIVO' | 'INACTIVO' | 'RESERVA'; sinReservaKids: boolean
  matriculaEstado: string | null; contratoEstadoKids: string | null
  contrato: string; ninoNombre: string; ninoDoc: string; edad: number | null; usuarioKids: string | null
  apoderadoNombre: string; apoderadoDoc: string; apoderadoEmail: string; apoderadoTelefono: string; parentesco: string
  inicio: string | null; finalContrato: string | null
  personId: string | null; aprobacionLgs: string | null; estadoLgs: string | null; inactivoLgs: boolean
}
interface Salon {
  id: string; nombre: string; curso: string; pais: string | null; activo: boolean
  cupo: number | null; ocupados: number | null; guia: string | null; horario: Slot[]
  horarioTexto: string | null; noEnKids: boolean; inscritos: Inscrito[]
}
interface Campania {
  id: string; nombre: string; estado: string; inicio: string | null; fin: string | null; finalVenta: string | null
  salones: Salon[]
}

type Tab = 'MATRICULADOS' | 'RESERVA'
type FiltroEstado = 'ACTIVO' | 'INACTIVO' | 'TODOS'

const PAIS: Record<string, string> = { CL: 'Chile', CO: 'Colombia', EC: 'Ecuador', PE: 'Perú' }
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const ORDEN_CURSO: Record<string, number> = { JUNIOR: 0, YOUNGSTER: 1 }
const ESTADO_CAMPANIA: Record<string, string> = { EN_MATRICULA: 'En matrícula', ACTIVA: 'En curso', CERRADA: 'Cerrada' }
const TODAS = '__todas__'

const fmtFecha = (v?: string | null) => {
  const [y, m, d] = String(v || '').slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '—'
}
const horaFin = (inicio: string, dur: number) => {
  const [h, m] = inicio.split(':').map(Number)
  const t = (h || 0) * 60 + (m || 0) + dur
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
/** Igual que el panel de KIDS: agrupa los días por hora → "LUN-MIÉ 17:00-18:00". */
const resumenHorario = (s: Salon) => {
  if (!s.horario?.length) return s.horarioTexto || '—'
  const grupos = new Map<string, { dias: number[]; dur: number; tipo: string }>()
  for (const x of s.horario) {
    const clave = `${x.horaLocal}|${x.tipo}`
    const g = grupos.get(clave) ?? { dias: [], dur: x.duracionMin, tipo: x.tipo }
    g.dias.push(x.diaSemana)
    grupos.set(clave, g)
  }
  return Array.from(grupos.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([clave, g]) => {
      const hora = clave.split('|')[0]
      const dias = g.dias.sort((a, b) => a - b).map(d => DIAS[d] ?? '?').join('-')
      return `${dias} ${hora}-${horaFin(hora, g.dur)}${g.tipo === 'CLUB' ? ' (Club)' : ''}`
    })
    .join(' · ')
}
/** "JUNIOR Salón 01" → "Salón 01" (el curso ya va en su columna). */
const etiquetaSalon = (s: Salon) => s.nombre.replace(new RegExp(`^${s.curso}\\s+`, 'i'), '')

/** Estado que se muestra para el inscrito (badge + CSV). */
const estadoInscrito = (i: Inscrito): { texto: string; cls: string } => {
  if (i.grupo === 'RESERVA') {
    return i.sinReservaKids
      ? { texto: 'Sin reserva en KIDS', cls: 'bg-amber-100 text-amber-800' }
      : { texto: 'Reservado en KIDS', cls: 'bg-blue-100 text-blue-800' }
  }
  if (i.grupo === 'ACTIVO') return { texto: 'Activo', cls: 'bg-green-100 text-green-800' }
  const motivo = i.contratoEstadoKids === 'ONHOLD' ? 'Suspendido'
    : i.matriculaEstado === 'FINALIZADA' ? 'Finalizado'
      : i.matriculaEstado === 'CANCELADA' ? 'Cancelado' : 'Inactivo'
  return { texto: motivo, cls: 'bg-red-100 text-red-700' }
}

export default function KidsAprobacionPage() {
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [consultado, setConsultado] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('MATRICULADOS')
  const [estado, setEstado] = useState<FiltroEstado>('ACTIVO')
  const [campania, setCampania] = useState<string>('')
  const [curso, setCurso] = useState('')
  const [salon, setSalon] = useState('')
  const [guia, setGuia] = useState('')
  const [conVacios, setConVacios] = useState(false)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/postgres/aprobacion/kids', { cache: 'no-store' })
      const j = await res.json()
      if (j?.success === false) throw new Error(j.error || 'Error al consultar')
      const lista: Campania[] = Array.isArray(j.campanias) ? j.campanias : []
      setConfigured(j.configured !== false)
      setError(j.error || null)
      setCampanias(lista)
      setConsultado(j.consultado || new Date().toISOString())
      // Default: la campaña en matrícula (si no hay, todas). Se respeta la elección previa.
      setCampania(prev => prev && (prev === TODAS || lista.some(c => c.id === prev))
        ? prev
        : (lista.find(c => c.estado === 'EN_MATRICULA')?.id ?? TODAS))
    } catch (e: any) {
      setError(e?.message || 'Error al consultar')
      setCampanias([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  /** ¿El inscrito entra en la pestaña / estado actual? */
  const entra = (i: Inscrito, t: Tab = tab, e: FiltroEstado = estado) =>
    t === 'RESERVA' ? i.grupo === 'RESERVA' : i.grupo !== 'RESERVA' && (e === 'TODOS' || i.grupo === e)

  const enCampania = useMemo(
    () => campanias.filter(c => !campania || campania === TODAS || c.id === campania),
    [campanias, campania],
  )

  // Opciones de los filtros (dependen de la campaña elegida).
  const salonesBase = enCampania.flatMap(c => c.salones)
  const tiposCurso = Array.from(new Set(salonesBase.map(s => s.curso))).sort((a, b) => (ORDEN_CURSO[a] ?? 9) - (ORDEN_CURSO[b] ?? 9))
  const nombresSalon = Array.from(new Set(salonesBase.filter(s => !curso || s.curso === curso).map(etiquetaSalon)))
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const guias = Array.from(new Set(salonesBase.map(s => s.guia || ''))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))

  // Filas: un salón por fila, con solo los inscritos de la pestaña/estado.
  const filas = useMemo(() => enCampania.flatMap(c => c.salones
    .filter(s => (!curso || s.curso === curso) && (!salon || etiquetaSalon(s) === salon) && (!guia || s.guia === guia))
    .map(s => ({ c, s, inscritos: s.inscritos.filter(i => entra(i)) }))
    .filter(f => conVacios || f.inscritos.length > 0))
    .sort((a, b) => a.c.nombre.localeCompare(b.c.nombre)
      || (ORDEN_CURSO[a.s.curso] ?? 9) - (ORDEN_CURSO[b.s.curso] ?? 9)
      || a.s.nombre.localeCompare(b.s.nombre, 'es', { numeric: true })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [enCampania, curso, salon, guia, conVacios, tab, estado])

  // Contadores (respetan campaña/curso/salón/guía, no la pestaña).
  const filtrados = enCampania.flatMap(c => c.salones)
    .filter(s => (!curso || s.curso === curso) && (!salon || etiquetaSalon(s) === salon) && (!guia || s.guia === guia))
    .flatMap(s => s.inscritos)
  const cuenta = (t: Tab, e: FiltroEstado = 'TODOS') => filtrados.filter(i => entra(i, t, e)).length
  const totalVisibles = filas.reduce((a, f) => a + f.inscritos.length, 0)
  const sinReservaKids = filtrados.filter(i => i.grupo === 'RESERVA' && i.sinReservaKids).length

  const toggle = (id: string) => setAbiertos(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const todosAbiertos = filas.length > 0 && filas.every(f => abiertos.has(f.s.id))

  // CSV: un renglón por inscrito visible (respeta pestaña, estado y filtros).
  const descargarCsv = () => {
    const rows = filas.flatMap(f => f.inscritos.map(i => ({ ...f, i })))
    type F = typeof rows[number]
    const sufijo = tab === 'RESERVA' ? 'en-reserva' : `matriculados-${estado === 'ACTIVO' ? 'activos' : estado === 'INACTIVO' ? 'inactivos' : 'todos'}`
    exportToExcel<F>(rows, [
      { header: 'Campaña', accessor: r => r.c.nombre },
      { header: 'Curso', accessor: r => r.s.curso },
      { header: 'Salón', accessor: r => etiquetaSalon(r.s) },
      { header: 'País', accessor: r => PAIS[r.s.pais || ''] || r.s.pais || '' },
      { header: 'Guía', accessor: r => r.s.guia || '' },
      { header: 'Horarios', accessor: r => resumenHorario(r.s) },
      { header: 'Niño', accessor: r => r.i.ninoNombre },
      { header: 'ID niño', accessor: r => r.i.ninoDoc },
      { header: 'Edad', accessor: r => r.i.edad ?? '' },
      { header: 'Usuario KIDS', accessor: r => r.i.usuarioKids || '' },
      { header: 'Contrato', accessor: r => r.i.contrato },
      { header: 'Apoderado', accessor: r => r.i.apoderadoNombre },
      { header: 'ID apoderado', accessor: r => r.i.apoderadoDoc },
      { header: 'Email', accessor: r => r.i.apoderadoEmail },
      { header: 'Teléfono', accessor: r => r.i.apoderadoTelefono },
      { header: 'Parentesco', accessor: r => r.i.parentesco },
      { header: 'Estado', accessor: r => estadoInscrito(r.i).texto },
      { header: 'Aprobación LGS', accessor: r => r.i.aprobacionLgs || '' },
      { header: 'Inicio', accessor: r => fmtFecha(r.i.inicio) },
      { header: 'Final contrato', accessor: r => fmtFecha(r.i.finalContrato) },
    ], `kids-${sufijo}_${new Date().toISOString().slice(0, 10)}`)
  }

  const campSel = campanias.find(c => c.id === campania)

  return (
    <DashboardLayout>
      <PermissionGuard permission={AprobacionPermission.KIDS_VER} showDefaultMessage>
        <div className="space-y-5 pb-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <FaceSmileIcon className="h-7 w-7 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Kids</h1>
                <p className="text-sm text-gray-500">
                  Usuarios Kids por campaña, curso y salón, según KIDS2026. Haz clic en un salón para ver sus inscritos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={descargarCsv} disabled={loading || totalVisibles === 0}
                title="Descarga los inscritos visibles (pestaña y filtros aplicados)"
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50">
                <ArrowDownTrayIcon className="h-4 w-4" /> Descargar CSV
              </button>
              <button type="button" onClick={load} disabled={loading}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
              </button>
            </div>
          </div>

          {!configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              La integración con KIDS2026 no está configurada en esta plataforma: solo se muestran los inscritos registrados en LGS.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              <strong>No se pudo consultar KIDS2026.</strong> {error} Solo se muestran los inscritos registrados en LGS.
            </div>
          )}

          {/* Pestañas */}
          <div className="border-b border-gray-200 flex gap-1">
            {([['MATRICULADOS', 'Matriculados'], ['RESERVA', 'En reserva']] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label} <span className="ml-1 text-xs text-gray-400">({t === 'RESERVA' ? cuenta('RESERVA') : cuenta('MATRICULADOS')})</span>
              </button>
            ))}
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-3">
            {tab === 'MATRICULADOS' && (
              <div>
                <span className="block text-xs text-gray-500 mb-1">Estado</span>
                <div className="flex gap-1">
                  {(['ACTIVO', 'INACTIVO', 'TODOS'] as const).map(op => (
                    <button key={op} type="button" onClick={() => setEstado(op)}
                      className={`px-3 py-2 text-sm rounded-lg border ${estado === op ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {op === 'ACTIVO' ? 'Activos' : op === 'INACTIVO' ? 'Inactivos' : 'Todos'} ({cuenta('MATRICULADOS', op)})
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label htmlFor="kk-camp" className="block text-xs text-gray-500 mb-1">Campaña</label>
              <select id="kk-camp" value={campania} onChange={e => { setCampania(e.target.value); setSalon(''); setGuia('') }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]">
                <option value={TODAS}>Todas</option>
                {campanias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.estado ? ` · ${ESTADO_CAMPANIA[c.estado] || c.estado}` : ' · solo LGS'}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="kk-curso" className="block text-xs text-gray-500 mb-1">Curso</label>
              <select id="kk-curso" value={curso} onChange={e => { setCurso(e.target.value); setSalon('') }}
                className={`border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[150px] ${curso ? `font-bold ${cursoColorCls(curso)}` : ''}`}>
                <option value="" className="font-normal text-gray-900">Todos</option>
                {tiposCurso.map(t => <option key={t} value={t} className={`font-bold ${cursoColorCls(t)}`}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="kk-salon" className="block text-xs text-gray-500 mb-1">Salón</label>
              <select id="kk-salon" value={salon} onChange={e => setSalon(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[150px]">
                <option value="">Todos</option>
                {nombresSalon.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="kk-guia" className="block text-xs text-gray-500 mb-1">Guía</label>
              <select id="kk-guia" value={guia} onChange={e => setGuia(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[180px]">
                <option value="">Todos</option>
                {guias.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input type="checkbox" checked={conVacios} onChange={e => setConVacios(e.target.checked)} />
              Mostrar salones sin inscritos
            </label>
            {consultado && (
              <span className="ml-auto text-xs text-gray-400 pb-2">
                Consultado: {new Date(consultado).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </div>

          {campSel && (
            <p className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1 px-1">
              <span>Campaña <strong>{campSel.nombre}</strong>{campSel.estado ? ` (${ESTADO_CAMPANIA[campSel.estado] || campSel.estado})` : ''}</span>
              {campSel.inicio && <span>Vigencia: <strong>{fmtFecha(campSel.inicio)} → {fmtFecha(campSel.fin)}</strong></span>}
              {campSel.finalVenta && <span>Cierre de ventas: <strong className="text-purple-700">{fmtFecha(campSel.finalVenta)}</strong></span>}
            </p>
          )}
          {tab === 'RESERVA' && sinReservaKids > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              {sinReservaKids} {sinReservaKids === 1 ? 'niño está inscrito' : 'niños están inscritos'} en LGS sin reserva en KIDS
              (no retienen cupo). La reserva se crea desde su ficha (Administración › Reservar / Matricular en KIDS) o al aprobarlo.
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" /><p className="text-sm text-gray-400">Consultando KIDS2026…</p></div>
          ) : filas.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
              No hay {tab === 'RESERVA' ? 'reservas' : 'matriculados'} para los filtros seleccionados.
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>{filas.length} {filas.length === 1 ? 'salón' : 'salones'} · {totalVisibles} {totalVisibles === 1 ? 'inscrito' : 'inscritos'}</span>
                <button type="button" className="text-purple-700 hover:underline"
                  onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(filas.map(f => f.s.id)))}>
                  {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['', 'Campaña', 'Curso', 'Salón', 'Guía', 'Horarios', 'Inscritos', 'Cupo'].map((h, k) => (
                      <th key={k} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map(({ c, s, inscritos }) => {
                    const abierto = abiertos.has(s.id)
                    const lleno = s.cupo != null && s.ocupados != null && s.ocupados >= s.cupo
                    return (
                      <Fragment key={s.id}>
                        <tr onClick={() => toggle(s.id)}
                          className={`cursor-pointer ${abierto ? 'bg-purple-50' : 'hover:bg-gray-50'} ${s.activo ? '' : 'opacity-60'}`}>
                          <td className="pl-3 py-2 w-6 text-gray-400">
                            {abierto ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                          </td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{c.nombre}</td>
                          <td className={`px-3 py-2 font-bold ${cursoColorCls(s.curso) || 'text-gray-900'}`}>{s.curso}</td>
                          <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                            {etiquetaSalon(s)}
                            {s.pais && <span className="ml-1 text-xs font-normal text-gray-400">{PAIS[s.pais] || s.pais}</span>}
                            {!s.activo && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">INACTIVO</span>}
                            {s.noEnKids && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">NO EXISTE EN KIDS</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{s.guia || <span className="text-gray-400">— sin guía —</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{resumenHorario(s)}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{inscritos.length}</td>
                          <td className={`px-3 py-2 whitespace-nowrap ${lleno ? 'text-red-700 font-semibold' : 'text-gray-700'}`}
                            title={s.ocupados != null ? `Ocupados en KIDS (activos + reservas): ${s.ocupados}` : undefined}>
                            {s.cupo ?? '—'}
                            {s.cupo != null && s.ocupados != null && (
                              <span className="ml-1 text-xs text-gray-400">({Math.max(0, s.cupo - s.ocupados)} libres)</span>
                            )}
                          </td>
                        </tr>
                        {abierto && (
                          <tr>
                            <td colSpan={8} className="bg-gray-50 px-6 py-3">
                              {inscritos.length === 0 ? (
                                <p className="text-sm text-gray-400">Sin inscritos en esta vista.</p>
                              ) : (
                                <table className="w-full text-xs bg-white border border-gray-200 rounded-lg">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      {['Niño', 'ID', 'Edad', 'Contrato', 'Apoderado', 'ID apoderado', 'Email', 'Teléfono', 'Estado'].map(h => (
                                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {inscritos.map(i => {
                                      const est = estadoInscrito(i)
                                      return (
                                        <tr key={i.ref}>
                                          <td className="px-2 py-1.5 font-medium text-gray-900">
                                            {i.personId
                                              ? <Link href={`/person/${i.personId}`} target="_blank" className="text-purple-700 hover:underline">{i.ninoNombre}</Link>
                                              : i.ninoNombre}
                                            {i.usuarioKids && <span className="block text-[10px] text-gray-400">{i.usuarioKids}</span>}
                                          </td>
                                          <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{i.ninoDoc}</td>
                                          <td className="px-2 py-1.5 text-gray-700">{i.edad ?? '—'}</td>
                                          <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{i.contrato}</td>
                                          <td className="px-2 py-1.5 text-gray-700">
                                            {i.apoderadoNombre || '—'}
                                            {i.parentesco && <span className="block text-[10px] text-gray-400">{i.parentesco}</span>}
                                          </td>
                                          <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{i.apoderadoDoc || '—'}</td>
                                          <td className="px-2 py-1.5 text-gray-700">{i.apoderadoEmail || '—'}</td>
                                          <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{i.apoderadoTelefono || '—'}</td>
                                          <td className="px-2 py-1.5 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${est.cls}`}>{est.texto}</span>
                                            {i.aprobacionLgs && i.grupo === 'RESERVA' && (
                                              <span className="block text-[10px] text-gray-400 mt-0.5">LGS: {i.aprobacionLgs}</span>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}
