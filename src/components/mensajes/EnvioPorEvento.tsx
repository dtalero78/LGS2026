'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { MantenimientoPermission } from '@/types/permissions'
import { fillTemplate } from '@/lib/message-template-filler'

interface Template { _id: string; slug: string; nombre: string; contenido: string }
interface Evento { _id: string; dia: string; tipo: string; nivel: string; step: string | null; titulo: string | null; limiteUsuarios: number | null; advisorNombre: string | null; inscritos: number }
interface Inscrito {
  bookingId: string; numeroId: string; nombre: string; primerApellido: string; celular: string; celularValido: boolean; inactivo: boolean
  nivel: string; step: string; plataforma: string; contrato: string; fechaEvento: string; horaEvento: string
}
interface EventoDetalle { _id: string; dia: string; tipo: string; titulo: string | null; advisor: string | null; linkZoom: string | null }

const MARCADORES = ['nombre', 'nombreCompleto', 'fechaEvento', 'horaEvento', 'tipoEvento', 'tituloEvento', 'advisor', 'linkZoom', 'nivel', 'step']
const TIPOS = [['', 'Todos'], ['SESSION', 'Sesión'], ['CLUB', 'Club'], ['WELCOME', 'Welcome']]
const hoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)
const fmtDia = (d: string) => new Date(d).toLocaleString('es', { timeZone: 'America/Bogota', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export default function EnvioPorEvento({ templates }: { templates: Template[] }) {
  const { hasPermission } = usePermissions()
  const puedePersonalizado = hasPermission(MantenimientoPermission.ENVIO_MENSAJES_PERSONALIZADO)

  const [f, setF] = useState({ desde: hoy(), hasta: hoy(), tipo: '', advisor: '', nivel: '' })
  const [advisors, setAdvisors] = useState<{ _id: string; nombre: string }[]>([])
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [evento, setEvento] = useState<EventoDetalle | null>(null)
  const [inscritos, setInscritos] = useState<Inscrito[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modo, setModo] = useState<'plantilla' | 'personalizado'>('plantilla')
  const [plantillaId, setPlantillaId] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ enviados: number; fallidos: number; resultados: any[] } | null>(null)

  useEffect(() => {
    fetch('/api/postgres/advisors').then(r => r.json()).then(j => {
      const arr = j?.data?.advisors || j?.advisors || j?.data || []
      setAdvisors((Array.isArray(arr) ? arr : []).map((a: any) => ({ _id: a._id, nombre: `${a.primerNombre || ''} ${a.primerApellido || ''}`.trim() }))
        .filter((a: any) => a.nombre).sort((x: any, y: any) => x.nombre.localeCompare(y.nombre, 'es')))
    }).catch(() => {})
  }, [])

  const buscar = async () => {
    setBuscando(true); setEventos(null)
    try {
      const qs = new URLSearchParams({ desde: f.desde, hasta: f.hasta })
      if (f.tipo) qs.set('tipo', f.tipo); if (f.advisor) qs.set('advisor', f.advisor); if (f.nivel.trim()) qs.set('nivel', f.nivel.trim())
      const r = await fetch(`/api/admin/envio-mensajes/eventos?${qs}`); const j = await r.json()
      if (!j.success) throw new Error(j.error || 'No se pudieron cargar los eventos')
      setEventos(j.data?.eventos ?? j.eventos ?? [])
    } catch (e: any) { toast.error(e.message) } finally { setBuscando(false) }
  }

  const elegirEvento = async (id: string) => {
    try {
      const r = await fetch(`/api/admin/envio-mensajes/eventos/${id}/inscritos`); const j = await r.json()
      if (!j.success) throw new Error(j.error || 'No se pudieron cargar los inscritos')
      const d = j.data ?? j
      setEvento(d.evento); setInscritos(d.inscritos); setResultado(null)
      setSel(new Set(d.inscritos.filter((i: Inscrito) => i.celularValido && !i.inactivo).map((i: Inscrito) => i.bookingId)))
    } catch (e: any) { toast.error(e.message) }
  }

  const plantilla = templates.find(t => t._id === plantillaId) || null
  const base = modo === 'plantilla' ? plantilla?.contenido || '' : texto
  const muestra = inscritos.find(i => sel.has(i.bookingId)) || inscritos[0]
  const vista = useMemo(() => {
    if (!base || !muestra || !evento) return base
    return fillTemplate(base, {
      nombre: muestra.nombre, primerApellido: muestra.primerApellido, nivel: muestra.nivel, step: muestra.step, plataforma: muestra.plataforma,
      contrato: muestra.contrato, numeroId: muestra.numeroId, fechaEvento: muestra.fechaEvento, horaEvento: muestra.horaEvento,
      tipoEvento: evento.tipo, tituloEvento: evento.titulo, advisor: evento.advisor, linkZoom: evento.linkZoom,
    })
  }, [base, muestra, evento])

  const enviar = async (confirmarRepetido = false) => {
    if (!evento) return
    if (!confirmarRepetido && !confirm(`¿Enviar este mensaje a ${sel.size} persona(s) del evento «${evento.titulo || evento.tipo}»?`)) return
    setEnviando(true)
    try {
      const r = await fetch(`/api/admin/envio-mensajes/eventos/${evento._id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(modo === 'plantilla' ? { plantillaId } : { texto }), bookingIds: Array.from(sel), confirmarRepetido }),
      })
      const j = await r.json()
      if (r.status === 409 && !confirmarRepetido) {
        if (confirm(`${j.error}\n\n¿Enviarlo de nuevo?`)) { setEnviando(false); return enviar(true) }
        return
      }
      if (!j.success) throw new Error(j.error || 'Error al enviar')
      setResultado(j.data ?? j)
      toast.success(`Enviados: ${(j.data ?? j).enviados}`)
    } catch (e: any) { toast.error(e.message) } finally { setEnviando(false) }
  }

  const campo = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full'
  const listo = sel.size > 0 && !!base.trim()

  return (
    <div className="space-y-4">
      {/* 1. Evento */}
      {!evento && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">1. Elige el evento</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <label className="text-xs text-gray-600">Desde<input type="date" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value, hasta: e.target.value > f.hasta ? e.target.value : f.hasta })} className={campo} /></label>
            <label className="text-xs text-gray-600">Hasta (máx. 31 días)<input type="date" value={f.hasta} min={f.desde} onChange={e => setF({ ...f, hasta: e.target.value })} className={campo} /></label>
            <label className="text-xs text-gray-600">Tipo<select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} className={campo}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="text-xs text-gray-600">Advisor<select value={f.advisor} onChange={e => setF({ ...f, advisor: e.target.value })} className={campo}><option value="">Todos</option>{advisors.map(a => <option key={a._id} value={a._id}>{a.nombre}</option>)}</select></label>
            <label className="text-xs text-gray-600">Nivel<input value={f.nivel} onChange={e => setF({ ...f, nivel: e.target.value })} placeholder="Ej. BN1" className={campo} /></label>
          </div>
          <button type="button" onClick={buscar} disabled={buscando} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{buscando ? 'Buscando…' : 'Buscar eventos'}</button>
          {eventos && (eventos.length === 0 ? <p className="text-sm text-gray-500">No hay eventos con esos filtros.</p> : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr>{['Fecha / hora (Bogotá)', 'Tipo', 'Título', 'Advisor', 'Inscritos', ''].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {eventos.map(e => (
                    <tr key={e._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDia(e.dia)}</td>
                      <td className="px-3 py-2">{e.tipo}{e.nivel ? ` · ${e.nivel}` : ''}{e.step ? ` ${e.step}` : ''}</td>
                      <td className="px-3 py-2">{e.titulo || '—'}</td>
                      <td className="px-3 py-2">{e.advisorNombre || '—'}</td>
                      <td className="px-3 py-2">{e.inscritos}{e.limiteUsuarios ? ` / ${e.limiteUsuarios}` : ''}</td>
                      <td className="px-3 py-2 text-right"><button type="button" disabled={e.inscritos === 0} onClick={() => elegirEvento(e._id)} className="text-indigo-700 hover:underline disabled:text-gray-300 disabled:no-underline">Elegir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {evento && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{evento.titulo || evento.tipo}</h2>
                <p className="text-sm text-gray-500">{evento.tipo} · {fmtDia(evento.dia)} · {evento.advisor || 'sin advisor'}</p>
              </div>
              <button type="button" onClick={() => { setEvento(null); setResultado(null) }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cambiar evento</button>
            </div>
          </div>

          {/* 2. Destinatarios */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">2. Destinatarios ({sel.size} de {inscritos.length})</h2>
              <div className="text-xs space-x-3">
                <button type="button" className="text-indigo-700 hover:underline" onClick={() => setSel(new Set(inscritos.filter(i => i.celularValido && !i.inactivo).map(i => i.bookingId)))}>Marcar elegibles</button>
                <button type="button" className="text-gray-600 hover:underline" onClick={() => setSel(new Set())}>Quitar todos</button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {inscritos.map(i => (
                <label key={i.bookingId} className={`flex items-center gap-3 px-3 py-2 text-sm ${i.celularValido ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50 text-gray-400'}`}>
                  <input type="checkbox" disabled={!i.celularValido} checked={sel.has(i.bookingId)}
                    onChange={() => setSel(s => { const n = new Set(s); n.has(i.bookingId) ? n.delete(i.bookingId) : n.add(i.bookingId); return n })} />
                  <span className="flex-1">{i.nombre} {i.primerApellido} <span className="text-xs text-gray-400">· {i.numeroId} · {i.nivel} {i.step}</span></span>
                  {i.inactivo && <span className="text-[10px] rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-semibold">Inactivo</span>}
                  {!i.celularValido && <span className="text-[10px] rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 font-semibold">Sin celular</span>}
                </label>
              ))}
            </div>
          </div>

          {/* 3. Mensaje */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">3. Mensaje</h2>
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setModo('plantilla')} className={`px-3 py-1.5 rounded-lg border ${modo === 'plantilla' ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'border-gray-300'}`}>Plantilla</button>
              {puedePersonalizado && <button type="button" onClick={() => setModo('personalizado')} className={`px-3 py-1.5 rounded-lg border ${modo === 'personalizado' ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'border-gray-300'}`}>Personalizado</button>}
            </div>
            {modo === 'plantilla' ? (
              <select value={plantillaId} onChange={e => setPlantillaId(e.target.value)} className={campo}>
                <option value="">— Selecciona una plantilla —</option>
                {templates.map(t => <option key={t._id} value={t._id}>{t.nombre} ({t.slug})</option>)}
              </select>
            ) : (
              <>
                <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} maxLength={1500} placeholder="Escribe el mensaje…" className={campo} />
                <div className="flex flex-wrap gap-1.5">
                  {MARCADORES.map(m => <button key={m} type="button" onClick={() => setTexto(t => `${t}{{${m}}}`)} className="text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">{`{{${m}}}`}</button>)}
                </div>
              </>
            )}
            {base.trim() && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-1">Vista previa (con datos de {muestra ? `${muestra.nombre} ${muestra.primerApellido}` : 'un inscrito'}):</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{vista}</p>
              </div>
            )}
            <button type="button" onClick={() => enviar()} disabled={!listo || enviando} className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
              {enviando ? 'Enviando…' : `Enviar a ${sel.size} persona${sel.size === 1 ? '' : 's'}`}
            </button>
          </div>

          {resultado && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Resultado: {resultado.enviados} enviados · {resultado.fallidos} fallidos</h2>
              <div className="max-h-60 overflow-y-auto text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {resultado.resultados.map((r: any) => (
                  <div key={r.bookingId} className="px-3 py-1.5 flex justify-between"><span>{r.nombre}</span><span className={r.ok ? 'text-green-700' : 'text-red-700'}>{r.ok ? 'Enviado' : r.error}</span></div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
