'use client'

/**
 * /panel-estudiante/book-ess — "Book ESS New" (libro LGS ESSENTIAL, ST00-00).
 *
 *  - Todo pasa por /api/postgres/panel-estudiante/book-ess/* (sesión + alumno
 *    activo ESS · Step 0 + interruptor). Las páginas y el PDF llegan como URLs
 *    firmadas de 10 min; nunca hay rutas públicas.
 *  - Una página cuenta como vista tras 5 s visible con la imagen cargada.
 *  - Las evaluaciones se envían completas y se califican en el servidor; el
 *    cliente nunca recibe la clave (solo acierto/explicación tras enviar).
 *  - SUPER_ADMIN/ADMIN: vista previa de solo lectura.
 *  - Sin audios todavía: no se muestra el botón de audio.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface Pagina { page: number; id: string; unitId: string | null; kind: string; title: string; requerida: boolean; activityIds: string[] }
interface Actividad { id: string; unitId: string | null; type: 'single_choice' | 'open_response'; prompt: string; options?: { id: string; text: string }[]; maxLength?: number }
interface Evaluacion { id: string; unitId: string | null; activityIds: string[]; aprobarCon: number; total: number }
interface EvalAvance { mejor: number; total: number; aprobado: boolean; intentos: number }
interface Avance {
  paginasVistas: string[]
  lectura: { vistas: number; total: number; porcentaje: number }
  evaluaciones: Record<string, EvalAvance>
  unidadesAprobadas: number
  totalUnidades: number
  finalAprobado: boolean
  completado: boolean
}
interface Libro {
  bookCode: string
  version: string
  titulo: string
  preview: boolean
  flagActivo: boolean
  paginas: Pagina[]
  unidades: { id: string; numero: number; titulo: string; primeraPagina: number }[]
  actividades: Actividad[]
  evaluaciones: Evaluacion[]
  avance: Avance | null
  respuestas: Record<string, { texto: string; actualizadoEn: string; comentarioDocente: string | null }>
}
interface Resultado {
  correctas: number
  total: number
  aprobado: boolean
  aprobarCon: number
  resultados: { activityId: string; correcta: boolean; explicacion: string | null }[]
}

const API = '/api/postgres/panel-estudiante/book-ess'
const VISTA_MS = 5000
const FINAL_ID = 'ESS-FINAL'

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) throw new Error(json?.error || `Error ${res.status}`)
  return json
}

function nuevoRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export default function BookEssPage() {
  const [libro, setLibro] = useState<Libro | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [cargada, setCargada] = useState(false)
  const [avance, setAvance] = useState<Avance | null>(null)
  const vistasRef = useRef<Set<string>>(new Set())
  const reintentoRef = useRef<Set<string>>(new Set())
  const touchX = useRef<number | null>(null)

  // 1) Libro + avance
  useEffect(() => {
    api<{ data: Libro }>(API)
      .then(({ data }) => {
        setLibro(data)
        setAvance(data.avance)
        vistasRef.current = new Set(data.avance?.paginasVistas || [])
      })
      .catch((e) => setError(e.message))
  }, [])

  const paginas = libro?.paginas || []
  const pagina = paginas[idx]
  const actividades = useMemo(() => new Map((libro?.actividades || []).map((a) => [a.id, a])), [libro])

  // 2) URL firmada de la página actual + vecinas (prefetch)
  const pedirUrl = useCallback(async (p: Pagina, forzar = false) => {
    if (!forzar && urls[p.id]) return
    try {
      const { url } = await api<{ url: string }>(`${API}/pagina?id=${encodeURIComponent(p.id)}`)
      setUrls((u) => ({ ...u, [p.id]: url }))
    } catch (e: any) {
      setError(e.message)
    }
  }, [urls])

  useEffect(() => {
    if (!pagina) return
    setCargada(false)
    pedirUrl(pagina)
    const sig = paginas[idx + 1]
    const ant = paginas[idx - 1]
    if (sig) pedirUrl(sig)
    if (ant) pedirUrl(ant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina?.id])

  // 3) Página vista: 5 s acumulados visible con la imagen cargada
  useEffect(() => {
    if (!pagina || !cargada || !libro || libro.preview || vistasRef.current.has(pagina.id)) return
    let acumulado = 0
    let ultimo = Date.now()
    const timer = setInterval(() => {
      const ahora = Date.now()
      if (document.visibilityState === 'visible') acumulado += ahora - ultimo
      ultimo = ahora
      if (acumulado >= VISTA_MS) {
        clearInterval(timer)
        vistasRef.current.add(pagina.id)
        api<{ lectura: Avance['lectura'] }>(`${API}/vista`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: pagina.id }),
        })
          .then(({ lectura }) => setAvance((a) => (a ? { ...a, lectura } : a)))
          .catch(() => vistasRef.current.delete(pagina.id))
      }
    }, 500)
    return () => clearInterval(timer)
  }, [pagina, cargada, libro])

  // 4) Teclado
  const ir = useCallback((n: number) => {
    if (!paginas.length) return
    setIdx(Math.max(0, Math.min(paginas.length - 1, n)))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [paginas.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') ir(idx + 1)
      if (e.key === 'ArrowLeft') ir(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, ir])

  const abrirPdf = async (descargar: boolean) => {
    const w = descargar ? null : window.open('', '_blank')
    try {
      const { url } = await api<{ url: string }>(`${API}/pdf${descargar ? '?download=1' : ''}`)
      if (w) w.location.href = url
      else window.location.href = url
    } catch (e: any) {
      w?.close()
      setError(e.message)
    }
  }

  if (error && !libro) {
    return (
      <Pantalla>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <ExclamationTriangleIcon className="h-6 w-6 mb-2" />
          <p className="font-semibold">No puedes abrir el libro</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </Pantalla>
    )
  }
  if (!libro || !pagina) {
    return <Pantalla><div className="text-gray-500 py-12 text-center">Cargando libro…</div></Pantalla>
  }

  const idsSeleccion = pagina.activityIds.filter((id) => actividades.get(id)?.type === 'single_choice')
  const idsAbiertas = pagina.activityIds.filter((id) => actividades.get(id)?.type === 'open_response')
  const evaluacion = idsSeleccion.length
    ? libro.evaluaciones.find((e) => idsSeleccion.some((id) => e.activityIds.includes(id)))
    : undefined
  // Una evaluación puede repartirse en varias páginas (el reto final va en 85-87):
  // el formulario se muestra solo en la última; las anteriores enlazan a ella.
  const ultimaPaginaDe = (ev: Evaluacion) => {
    const ps = paginas.filter((p) => p.activityIds.some((id) => ev.activityIds.includes(id)))
    return ps[ps.length - 1]
  }
  const paginaFormulario = evaluacion ? ultimaPaginaDe(evaluacion) : undefined
  const evFinal = libro.evaluaciones.find((e) => e.id === FINAL_ID)
  const paginaFinal = evFinal ? paginas.find((p) => p.activityIds.some((id) => evFinal.activityIds.includes(id))) : undefined
  const unidadDe = (unitId: string | null) => libro.unidades.find((u) => u.id === unitId)

  return (
    <Pantalla>
      {libro.preview && (
        <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Vista previa de administrador: puedes leer y ver las actividades, pero no se guarda avance ni intentos.
          {!libro.flagActivo && ' El interruptor está apagado: los alumnos aún no ven el libro.'}
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{libro.titulo}</h1>
          <p className="text-xs text-gray-500">Essential · 12 unidades · {paginas.length} páginas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => abrirPdf(false)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            <DocumentTextIcon className="h-4 w-4" /> Ver PDF
          </button>
          <button onClick={() => abrirPdf(true)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            <DocumentArrowDownIcon className="h-4 w-4" /> Descargar
          </button>
        </div>
      </div>

      {/* Avance */}
      {avance && <PanelAvance avance={avance} />}

      {/* Unidades */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {libro.unidades.map((u) => {
          const ok = avance?.evaluaciones[`${u.id}-CHECKPOINT`]?.aprobado
          const activa = pagina.unitId === u.id
          return (
            <button
              key={u.id}
              onClick={() => ir(paginas.findIndex((p) => p.page === u.primeraPagina))}
              title={u.titulo}
              className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                activa ? 'bg-indigo-600 text-white border-indigo-600'
                  : ok ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {ok ? '✓ ' : ''}U{u.numero}
            </button>
          )
        })}
        {paginaFinal && (
          <button
            onClick={() => ir(paginas.findIndex((p) => p.id === paginaFinal.id))}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
              avance?.finalAprobado ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {avance?.finalAprobado ? '🏆 ' : ''}Reto final
          </button>
        )}
      </div>

      {/* Visor */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
          <button onClick={() => ir(idx - 1)} disabled={idx === 0} className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" aria-label="Página anterior">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-sm font-semibold text-gray-900 truncate">{pagina.title}</p>
            <p className="text-xs text-gray-500">
              Página {pagina.page} de {paginas.length}
              {pagina.unitId && unidadDe(pagina.unitId) ? ` · Unidad ${unidadDe(pagina.unitId)!.numero}` : ''}
              {vistasRef.current.has(pagina.id) && !libro.preview ? ' · leída' : ''}
            </p>
          </div>
          <button onClick={() => ir(idx + 1)} disabled={idx === paginas.length - 1} className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" aria-label="Página siguiente">
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
        <div
          className="bg-gray-50 flex justify-center min-h-[300px]"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            if (Math.abs(dx) > 50) ir(dx < 0 ? idx + 1 : idx - 1)
            touchX.current = null
          }}
        >
          {urls[pagina.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={pagina.id}
              src={urls[pagina.id]}
              alt={`Página ${pagina.page}: ${pagina.title}`}
              className="max-w-full h-auto select-none"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onLoad={() => { setCargada(true); reintentoRef.current.delete(pagina.id) }}
              onError={() => {
                // URL vencida (10 min): pedir una nueva una sola vez.
                if (!reintentoRef.current.has(pagina.id)) {
                  reintentoRef.current.add(pagina.id)
                  pedirUrl(pagina, true)
                }
              }}
            />
          ) : (
            <div className="py-24 text-sm text-gray-400">Cargando página…</div>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Actividades de la página */}
      {evaluacion && paginaFormulario && paginaFormulario.id !== pagina.id && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
          <span>Las preguntas de esta página se responden juntas en la página {paginaFormulario.page}.</span>
          <button
            onClick={() => ir(paginas.findIndex((p) => p.id === paginaFormulario.id))}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Ir a responder
          </button>
        </div>
      )}
      {evaluacion && paginaFormulario?.id === pagina.id && (
        <FormEvaluacion
          key={evaluacion.id}
          ev={evaluacion}
          actividades={actividades}
          version={libro.version}
          preview={libro.preview}
          previo={avance?.evaluaciones[evaluacion.id]}
          onAvance={setAvance}
        />
      )}
      {idsAbiertas.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Práctica escrita</h2>
          <p className="text-xs text-gray-500 mb-3">Tu docente puede revisar estas respuestas. No tienen nota automática.</p>
          <div className="space-y-4">
            {idsAbiertas.map((id) => (
              <RespuestaAbierta
                key={id}
                act={actividades.get(id)!}
                inicial={libro.respuestas[id]}
                preview={libro.preview}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button onClick={() => ir(idx - 1)} disabled={idx === 0} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          <ChevronLeftIcon className="h-4 w-4" /> Anterior
        </button>
        <button onClick={() => ir(idx + 1)} disabled={idx === paginas.length - 1} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
          Siguiente <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </Pantalla>
  )
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Link href="/panel-estudiante" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeftIcon className="h-4 w-4" /> Volver al panel
        </Link>
        {children}
      </div>
    </div>
  )
}

function PanelAvance({ avance }: { avance: Avance }) {
  const pctUnidades = Math.round((100 * avance.unidadesAprobadas) / avance.totalUnidades)
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <p className="text-xs text-gray-500">Unidades aprobadas</p>
        <p className="text-lg font-bold text-gray-900">{avance.unidadesAprobadas}/{avance.totalUnidades}</p>
        <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-indigo-600" style={{ width: `${pctUnidades}%` }} /></div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <p className="text-xs text-gray-500">Lectura</p>
        <p className="text-lg font-bold text-gray-900">{avance.lectura.porcentaje}%</p>
        <p className="text-xs text-gray-500">{avance.lectura.vistas} de {avance.lectura.total} páginas</p>
      </div>
      <div className={`rounded-xl border p-3 ${avance.completado ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
        <p className="text-xs text-gray-500">Reto final</p>
        {avance.completado ? (
          <p className="flex items-center gap-1 text-sm font-bold text-amber-700"><TrophyIcon className="h-5 w-5" /> Essential Explorer</p>
        ) : avance.finalAprobado ? (
          <p className="text-sm font-semibold text-emerald-700">Aprobado · faltan unidades</p>
        ) : avance.unidadesAprobadas === avance.totalUnidades ? (
          <p className="text-sm font-semibold text-gray-800">12/12 unidades; reto final pendiente</p>
        ) : (
          <p className="text-sm font-semibold text-gray-800">Pendiente</p>
        )}
      </div>
    </div>
  )
}

function FormEvaluacion({ ev, actividades, version, preview, previo, onAvance }: {
  ev: Evaluacion
  actividades: Map<string, Actividad>
  version: string
  preview: boolean
  previo?: EvalAvance
  onAvance: (a: Avance) => void
}) {
  const [sel, setSel] = useState<Record<string, string>>({})
  const [requestId, setRequestId] = useState(nuevoRequestId)
  const [enviando, setEnviando] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const esFinal = ev.id === FINAL_ID
  const completa = ev.activityIds.every((id) => sel[id])
  const porActividad = new Map((res?.resultados || []).map((r) => [r.activityId, r]))

  const enviar = async () => {
    if (!completa || enviando) return
    setEnviando(true)
    setErr(null)
    try {
      const { data } = await api<{ data: Resultado & { avance: Avance } }>(`${API}/intento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: ev.id,
          requestId,
          contentVersion: version,
          answers: ev.activityIds.map((id) => ({ activityId: id, optionId: sel[id] })),
        }),
      })
      setRes(data)
      onAvance(data.avance)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const otraVez = () => {
    setSel({})
    setRes(null)
    setErr(null)
    setRequestId(nuevoRequestId())
  }

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{esFinal ? 'Reto final' : 'Evaluación de la unidad'}</h2>
        <p className="text-xs text-gray-500">
          Aprueba con {ev.aprobarCon} de {ev.total}
          {previo ? ` · mejor nota ${previo.mejor}/${previo.total}${previo.aprobado ? ' ✓' : ''} · ${previo.intentos} intento(s)` : ''}
        </p>
      </div>

      <ol className="mt-3 space-y-4">
        {ev.activityIds.map((id, i) => {
          const act = actividades.get(id)
          if (!act) return null
          const r = porActividad.get(id)
          return (
            <li key={id}>
              <p className="text-sm font-medium text-gray-900">{i + 1}. {act.prompt}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(act.options || []).map((o) => (
                  <label
                    key={o.id}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                      sel[id] === o.id ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    } ${res ? 'pointer-events-none opacity-80' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`${ev.id}-${id}`}
                      className="sr-only"
                      checked={sel[id] === o.id}
                      onChange={() => setSel((s) => ({ ...s, [id]: o.id }))}
                      disabled={!!res}
                    />
                    {o.text}
                  </label>
                ))}
              </div>
              {r && (
                <p className={`mt-1 flex items-start gap-1 text-xs ${r.correcta ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.correcta ? <CheckCircleIcon className="h-4 w-4 flex-shrink-0" /> : <XCircleIcon className="h-4 w-4 flex-shrink-0" />}
                  <span>{r.correcta ? 'Correcto.' : 'Incorrecto.'}{r.explicacion ? ` ${r.explicacion}` : ''}</span>
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {res && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${res.aprobado ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          <b>{res.correctas}/{res.total}</b> — {res.aprobado
            ? (esFinal ? '¡Aprobaste el reto final!' : '¡Unidad aprobada! Ganaste el sello.')
            : `Necesitas ${res.aprobarCon} aciertos para aprobar. Puedes intentarlo de nuevo.`}
        </div>
      )}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 flex gap-2">
        {res ? (
          <button onClick={otraVez} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Intentar de nuevo
          </button>
        ) : (
          <button
            onClick={enviar}
            disabled={!completa || enviando || preview}
            title={preview ? 'Vista previa: no se envían intentos' : !completa ? 'Responde todas las preguntas' : ''}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {enviando ? 'Calificando…' : 'Enviar respuestas'}
          </button>
        )}
      </div>
    </div>
  )
}

function RespuestaAbierta({ act, inicial, preview }: {
  act: Actividad
  inicial?: { texto: string; comentarioDocente: string | null }
  preview: boolean
}) {
  const [texto, setTexto] = useState(inicial?.texto || '')
  const [guardado, setGuardado] = useState(inicial?.texto || '')
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const max = act.maxLength || 4000

  const guardar = async () => {
    setEstado('guardando')
    setErr(null)
    try {
      await api(`${API}/respuesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: act.id, texto }),
      })
      setGuardado(texto.trim())
      setEstado('ok')
    } catch (e: any) {
      setErr(e.message)
      setEstado('error')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-900" htmlFor={act.id}>{act.prompt}</label>
      <textarea
        id={act.id}
        value={texto}
        maxLength={max}
        rows={3}
        onChange={(e) => { setTexto(e.target.value); setEstado('idle') }}
        disabled={preview}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">{texto.length}/{max}</span>
        <div className="flex items-center gap-2">
          {estado === 'ok' && <span className="text-xs text-emerald-600">Guardado ✓</span>}
          {err && <span className="text-xs text-red-600">{err}</span>}
          <button
            onClick={guardar}
            disabled={preview || !texto.trim() || texto.trim() === guardado || estado === 'guardando'}
            className="rounded-md bg-gray-800 px-3 py-1 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-40"
          >
            {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
      {inicial?.comentarioDocente && (
        <p className="mt-1 rounded bg-sky-50 px-2 py-1 text-xs text-sky-800">Comentario de tu docente: {inicial.comentarioDocente}</p>
      )}
    </div>
  )
}
