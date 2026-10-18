'use client'

/**
 * /panel-estudiante/book-ess — "Book ESS New" (LGS ESSENTIAL, libro ST00-00).
 *
 * Mismo diseño y recorrido que el prototipo entregado con el libro
 * (Explorar · Mi ruta · Pasaporte · Recursos · unidades con Aprende /
 * Conversa / Practica / Evalúate / Libro), pero integrado a LGS:
 *  - Todo llega de /api/postgres/panel-estudiante/book-ess/* (sesión + alumno
 *    activo ESS · Step 0 + interruptor). Páginas, fotos y PDF = URLs firmadas.
 *  - Las evaluaciones se califican en el SERVIDOR (el cliente nunca recibe la
 *    clave) y el avance, las respuestas escritas y los sellos se guardan por
 *    alumno en PostgreSQL (no en el navegador).
 *  - Una página del libro cuenta como leída tras 5 s visible.
 *  - Audio: voz sintetizada del navegador (Web Speech API), como el prototipo.
 *    No hay grabaciones MP3 todavía.
 *  - SUPER_ADMIN/ADMIN: vista previa de solo lectura.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOOK_ESS_CSS } from './book-ess.css'

// ── Tipos ──────────────────────────────────────────────────────────────
interface Pagina { page: number; id: string; unitId: string | null; kind: string; title: string; requerida: boolean; activityIds: string[] }
interface Actividad { id: string; unitId: string | null; type: 'single_choice' | 'open_response'; prompt: string; options?: { id: string; text: string }[]; maxLength?: number }
interface Evaluacion { id: string; unitId: string | null; activityIds: string[]; aprobarCon: number; total: number }
interface Leccion { id: number; unitId: string; title: string; es: string; goal: string; explain: string; groups: { title: string; words: [string, string][] }[]; dialog: string[]; pages: number[] }
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
  alumno: { nombre: string }
  paginas: Pagina[]
  lecciones: Leccion[]
  imagenes: Record<string, string>
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
const FINAL_ID = 'ESS-FINAL'
const VISTA_MS = 5000
const TABS: Record<string, string> = {
  learn: '01 · Aprende',
  conversation: '02 · Conversa',
  practice: '03 · Practica',
  challenge: '04 · Evalúate',
  book: 'Libro',
}
// Muestras de escucha del prototipo (transcripción visible; no se califican).
const DICTADOS: Record<number, string[]> = {
  1: ['E', 'J', 'O', 'A', 'R', 'X', 'Y', 'W', 'Z', 'I'],
  2: ['zero nine eight four two three four five three four', 'five nine three seven eight four two five six seven', 'three five five seven four seven six two one'],
  12: ['She has long curly hair.', 'He is tall and has a beard.', 'She is young and has short hair.', 'He has straight black hair.', 'He is bald.'],
}

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) throw new Error(json?.error || `Error ${res.status}`)
  return json
}
const post = (url: string, body: any) =>
  api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
function nuevoRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
const pad = (n: number) => String(n).padStart(2, '0')
const pct = (e?: EvalAvance) => (e && e.total ? Math.round((100 * e.mejor) / e.total) : 0)
function leerLocal(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function escribirLocal(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* sin storage: no pasa nada */ } }

// ── Voz (Web Speech API, como el prototipo) ───────────────────────────
function useVoz(toast: (t: string) => void) {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([])
  const [voz, setVozState] = useState<string>('')
  const [rate, setRateState] = useState<number>(0.85)

  const cargar = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    const v = window.speechSynthesis.getVoices().filter((x) => /^en\b/i.test(x.lang))
    setVoces(v)
    return v
  }, [])

  useEffect(() => {
    const guardada = leerLocal('lgs-ess-voz')
    const r = Number(leerLocal('lgs-ess-rate'))
    if (guardada) setVozState(guardada)
    if (r >= 0.6 && r <= 1.1) setRateState(r)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => cargar()
      cargar()
    }
  }, [cargar])

  const elegida = useMemo(
    () => voces.find((v) => v.name === voz) || voces.find((v) => /zira/i.test(v.name)) || voces.find((v) => /natural|neural/i.test(v.name)) || voces[0],
    [voces, voz],
  )

  const speak = useCallback((texto: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { toast('Este navegador no permite síntesis de voz.'); return }
    const v = voces.length ? voces : cargar()
    if (!v.length) { toast('No hay una voz en inglés disponible en este dispositivo.'); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'en-US'
    u.voice = elegida || v[0]
    u.rate = rate
    u.onerror = (e: any) => { if (!['interrupted', 'canceled'].includes(e.error)) toast('No se pudo reproducir el audio. Revisa la configuración de voz.') }
    window.speechSynthesis.speak(u)
  }, [voces, elegida, rate, cargar, toast])

  const stop = useCallback(() => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  const setVoz = (n: string) => { setVozState(n); escribirLocal('lgs-ess-voz', n) }
  const setRate = (r: number) => { setRateState(r); escribirLocal('lgs-ess-rate', String(r)) }
  return { voces, elegida, rate, speak, stop, setVoz, setRate, cargar }
}

const nav = (h: string) => { window.location.hash = h }

// ── Página ────────────────────────────────────────────────────────────
export default function BookEssPage() {
  const [libro, setLibro] = useState<Libro | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [avance, setAvance] = useState<Avance | null>(null)
  const [ruta, setRuta] = useState('home')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [audioOpen, setAudioOpen] = useState(false)
  const vistasRef = useRef<Set<string>>(new Set())
  const ultimaRecarga = useRef(0)

  const toast = useCallback((t: string) => {
    setToastMsg(t)
    window.clearTimeout((window as any).__bkToast)
    ;(window as any).__bkToast = window.setTimeout(() => setToastMsg(null), 4500)
  }, [])
  const voz = useVoz(toast)

  const cargarLibro = useCallback(async () => {
    const { data } = await api<{ data: Libro }>(API)
    setLibro(data)
    setAvance(data.avance)
    vistasRef.current = new Set(data.avance?.paginasVistas || [])
  }, [])

  useEffect(() => { cargarLibro().catch((e) => setError(e.message)) }, [cargarLibro])

  // Las fotos van firmadas por 10 min: si una falla, refrescar (máx. 1 vez/min).
  const refrescarImagenes = useCallback(() => {
    if (Date.now() - ultimaRecarga.current < 60_000) return
    ultimaRecarga.current = Date.now()
    api<{ data: Libro }>(API).then(({ data }) => setLibro((l) => (l ? { ...l, imagenes: data.imagenes } : l))).catch(() => {})
  }, [])

  // Rutas por hash (#home, #map, #unit/3/learn, #final, #passport, #resources, #libro)
  useEffect(() => {
    const leer = () => {
      setRuta(window.location.hash.slice(1) || 'home')
      voz.stop()
      window.scrollTo(0, 0)
    }
    leer()
    window.addEventListener('hashchange', leer)
    return () => window.removeEventListener('hashchange', leer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actividades = useMemo(() => new Map((libro?.actividades || []).map((a) => [a.id, a])), [libro])
  const { speak, stop } = voz
  const ctx: Ctx | null = useMemo(
    () => (libro ? { libro, avance, setAvance, nav, toast, speak, stop, actividades, vistasRef, refrescarImagenes } : null),
    [libro, avance, toast, speak, stop, actividades, refrescarImagenes],
  )

  let vista: React.ReactNode = null
  if (ctx) {
    if (ruta.startsWith('unit/')) {
      const [, n, tab] = ruta.split('/')
      vista = <UnidadView ctx={ctx} id={Number(n)} tab={TABS[tab] ? tab : 'learn'} />
    } else if (ruta === 'map') vista = <RutaView ctx={ctx} />
    else if (ruta === 'passport') vista = <PasaporteView ctx={ctx} />
    else if (ruta === 'resources') vista = <RecursosView ctx={ctx} />
    else if (ruta === 'final') vista = <FinalView ctx={ctx} />
    else if (ruta === 'libro') vista = <LibroCompletoView ctx={ctx} />
    else vista = <HomeView ctx={ctx} />
  }

  return (
    <div className="bk">
      <style dangerouslySetInnerHTML={{ __html: BOOK_ESS_CSS }} />
      <header className="bk-top">
        <a className="brand" href="#home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/books/ess/logo.png" alt="Let's Go Speak" />
          <span>ESSENTIAL<small>YOUR ENGLISH JOURNEY</small></span>
        </a>
        <nav aria-label="Principal">
          <a href="/panel-estudiante">← Mi panel</a>
          <a href="#home" className={ruta === 'home' ? 'on' : ''}>Explorar</a>
          <a href="#map" className={ruta === 'map' ? 'on' : ''}>Mi ruta</a>
          <a href="#passport" className={ruta === 'passport' ? 'on' : ''}>Pasaporte</a>
          <a href="#resources" className={ruta === 'resources' ? 'on' : ''}>Recursos</a>
          <button type="button" onClick={() => { voz.cargar(); setAudioOpen(true) }} aria-label="Configurar voz">♫ Audio</button>
        </nav>
      </header>

      <main>
        {libro?.preview && (
          <div className="preview">
            Vista previa de administrador: puedes recorrer todo el libro, pero no se guardan respuestas, intentos ni avance.
            {!libro.flagActivo && ' El interruptor está apagado: los alumnos aún no lo ven.'}
          </div>
        )}
        {error && !libro && (
          <div className="panel">
            <p className="eyebrow">LGS · ESSENTIAL</p>
            <h2>No puedes abrir el libro</h2>
            <p className="muted">{error}</p>
            <a href="/panel-estudiante"><button type="button">← Volver a mi panel</button></a>
          </div>
        )}
        {!libro && !error && <p className="muted">Cargando libro…</p>}
        {vista}
      </main>

      <footer className="bk-foot">
        <b>LET’S GO SPEAK</b>
        <span>ESSENTIAL · Student’s interactive book</span>
        <span>Learn. Connect. Go further.</span>
      </footer>

      {audioOpen && (
        <div className="modal-bg" onClick={() => setAudioOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Configurar voz" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close" onClick={() => setAudioOpen(false)} aria-label="Cerrar">×</button>
            <p className="eyebrow">LISTEN & REPEAT</p>
            <h2>Tu voz de práctica</h2>
            <p>Se usa Microsoft Zira cuando está disponible. La voz depende de las voces instaladas en tu dispositivo.</p>
            <label htmlFor="bk-voice">Voz en inglés</label>
            <select id="bk-voice" value={voz.elegida?.name || ''} onChange={(e) => voz.setVoz(e.target.value)}>
              {voz.voces.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
            <label htmlFor="bk-rate">Velocidad {voz.rate.toFixed(2)}</label>
            <input id="bk-rate" type="range" min={0.6} max={1.1} step={0.05} value={voz.rate} onChange={(e) => voz.setRate(Number(e.target.value))} style={{ width: '100%' }} />
            <div className="actions">
              <button type="button" onClick={() => voz.speak('Welcome to Essential. Let’s go speak!')}>Probar voz</button>
              <button type="button" className="secondary" onClick={voz.stop}>Detener</button>
            </div>
            <p className="muted" style={{ marginTop: 16 }}>
              {voz.voces.length
                ? 'Audio sintetizado por el navegador. No es una grabación humana.'
                : 'No se encontró una voz en inglés. Activa una voz en inglés en el dispositivo para escuchar.'}
            </p>
          </div>
        </div>
      )}
      {toastMsg && <div className="toast" role="status" aria-live="polite">{toastMsg}</div>}
    </div>
  )
}

// ── Contexto compartido por las vistas ────────────────────────────────
interface Ctx {
  libro: Libro
  avance: Avance | null
  setAvance: React.Dispatch<React.SetStateAction<Avance | null>>
  nav: (h: string) => void
  toast: (t: string) => void
  speak: (t: string) => void
  stop: () => void
  actividades: Map<string, Actividad>
  vistasRef: React.MutableRefObject<Set<string>>
  refrescarImagenes: () => void
}

const evalUnidad = (ctx: Ctx, l: Leccion) => ctx.avance?.evaluaciones[`${l.unitId}-CHECKPOINT`]
const completadas = (ctx: Ctx) => ctx.avance?.unidadesAprobadas ?? 0

function FotoUnidad({ ctx, n, alt }: { ctx: Ctx; n: number; alt: string }) {
  const src = ctx.libro.imagenes[String(n)]
  if (!src) return <div className="imgph" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={ctx.refrescarImagenes} />
}

function UnitCard({ ctx, l }: { ctx: Ctx; l: Leccion }) {
  const e = evalUnidad(ctx, l)
  const score = pct(e)
  return (
    <a className="unitcard" href={`#unit/${l.id}/learn`}>
      <FotoUnidad ctx={ctx} n={l.id} alt="" />
      <div className="unitbody">
        <div className="unitmeta"><span>UNIT {pad(l.id)}</span><span>{e?.aprobado ? '✓ COMPLETADA' : 'ESSENTIAL'}</span></div>
        <h3>{l.title}</h3>
        <p>{l.goal}</p>
        <div className="progress"><i style={{ width: `${score}%` }} /></div>
        <div className="cardfoot"><span>{score ? `${score}% · mejor resultado` : 'Aprender · Practicar · Conectar'}</span><span>↗</span></div>
      </div>
    </a>
  )
}

// ── Explorar ──────────────────────────────────────────────────────────
function HomeView({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState('')
  const L = ctx.libro.lecciones
  const sig = L.find((l) => !evalUnidad(ctx, l)?.aprobado) || L[L.length - 1]
  const ultima = Number(leerLocal('lgs-ess-ultima')) || 1
  const lista = L.filter((l) => [l.title, l.es, l.goal].join(' ').toLocaleLowerCase().includes(q.toLocaleLowerCase()))
  return (
    <>
      <section className="hero">
        <div className="copy">
          <p className="eyebrow">LET’S GO SPEAK · ESSENTIAL</p>
          <h1>El mundo empieza<br />con un <em>hello.</em></h1>
          <p>Conecta con nuevas personas, descubre nuevas posibilidades y haz del inglés parte de tu vida.</p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => ctx.nav(`unit/${ultima}/learn`)}>
              {completadas(ctx) ? 'Continuar mi viaje' : 'Comenzar mi viaje'} ↗
            </button>
            <button type="button" className="ghost" onClick={() => ctx.nav('map')}>Ver mi ruta</button>
          </div>
        </div>
        <div className="hero-art">
          <FotoUnidad ctx={ctx} n={4} alt="Jóvenes compartiendo un momento juntos" />
          <div className="hero-tag"><span>SMALL STEPS.<br /><b>Real connections.</b></span><span>01 — 12<br />ESSENTIAL</span></div>
        </div>
      </section>
      <div className="stats">
        <div><b>12</b><span>unidades para tu día a día</span></div>
        <div><b>{ctx.avance ? `${ctx.avance.lectura.porcentaje}%` : '♫'}</b><span>{ctx.avance ? 'del libro leído' : 'escucha, practica y conversa'}</span></div>
        <div><b>{completadas(ctx)}/12</b><span>sellos en tu pasaporte</span></div>
      </div>
      <div className="section-head">
        <div>
          <p className="eyebrow">YOUR LEARNING JOURNEY</p>
          <h2>Un paso más cerca.</h2>
          <p className="muted">Explora cada unidad a tu ritmo. Tu próxima conexión empieza aquí.</p>
        </div>
        <label className="search">Buscar una unidad
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Familia, weather, ciudad…" />
        </label>
      </div>
      <div className="unitgrid">
        {lista.length ? lista.map((l) => <UnitCard key={l.id} ctx={ctx} l={l} />) : <p>No hay unidades con esa búsqueda.</p>}
      </div>
      <div className="banner">
        <div><p className="eyebrow">TU SIGUIENTE DESTINO</p><h3>{sig.title}</h3><p className="muted">{sig.goal}</p></div>
        <button type="button" onClick={() => ctx.nav(`unit/${sig.id}/learn`)}>Abrir unidad →</button>
      </div>
    </>
  )
}

// ── Mi ruta ───────────────────────────────────────────────────────────
function RutaView({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <p className="eyebrow">MI RUTA · ESSENTIAL</p>
      <h1 style={{ fontSize: 52 }}>Doce destinos.<br />Tu propio camino.</h1>
      <p>Estudia, practica y consigue al menos 3 de 4 aciertos en cada evaluación para ganar su sello. Todas las unidades están disponibles.</p>
      <div className="progress" style={{ margin: '25px 0' }}><i style={{ width: `${(completadas(ctx) / 12) * 100}%` }} /></div>
      <p className="muted">{completadas(ctx)} de 12 destinos completados</p>
      <div className="route">
        {ctx.libro.lecciones.map((l) => {
          const ok = evalUnidad(ctx, l)?.aprobado
          return (
            <a key={l.id} href={`#unit/${l.id}/learn`} className={ok ? 'done' : ''}>
              <strong>{pad(l.id)} {ok ? '✓' : ''}</strong>
              <h3>{l.title}</h3>
              <p className="muted">{l.es}</p>
              <span className="pill">Premio: sello {l.id} · {l.es}</span>
            </a>
          )
        })}
      </div>
      <div className="banner">
        <div><h3>El último destino eres tú.</h3><p>Integra lo aprendido en tu presentación personal y en el reto final.</p></div>
        <button type="button" onClick={() => ctx.nav('final')}>Práctica final →</button>
      </div>
    </>
  )
}

// ── Unidad ────────────────────────────────────────────────────────────
function UnidadView({ ctx, id, tab }: { ctx: Ctx; id: number; tab: string }) {
  const l = ctx.libro.lecciones.find((x) => x.id === id)
  useEffect(() => { if (l) escribirLocal('lgs-ess-ultima', String(l.id)) }, [l])
  if (!l) return <div className="panel"><p>Esa unidad no existe.</p><a href="#home">Volver a Explorar</a></div>
  const e = evalUnidad(ctx, l)
  return (
    <>
      <div className="breadcrumbs"><a href="#home">Essential</a> / Unit {id} / {TABS[tab]}</div>
      <section className="unit-hero">
        <div>
          <p className="eyebrow">UNIT {pad(id)} · {l.es}</p>
          <h1>{l.title}</h1>
          <p>{l.goal}</p>
          <span className="pill">{e?.aprobado ? '✓ Sello obtenido' : `Mejor resultado: ${pct(e)}%`}</span>
        </div>
        <FotoUnidad ctx={ctx} n={id} alt={`Imagen de apertura de la unidad ${id}`} />
      </section>
      <div className="tabs">
        {Object.entries(TABS).map(([k, label]) => (
          <button type="button" key={k} className={tab === k ? 'active' : ''} onClick={() => ctx.nav(`unit/${id}/${k}`)}>{label}</button>
        ))}
      </div>
      {tab === 'learn' && <Aprende ctx={ctx} l={l} />}
      {tab === 'conversation' && <Conversa ctx={ctx} l={l} />}
      {tab === 'practice' && <Practica ctx={ctx} l={l} />}
      {tab === 'challenge' && <Evalua ctx={ctx} l={l} />}
      {tab === 'book' && (
        <VisorPaginas key={`u${id}`} ctx={ctx} paginas={ctx.libro.paginas.filter((p) => l.pages.includes(p.page))} titulo={`Unidad ${id} en el libro`} />
      )}
      <div className="pager">
        <button type="button" className="secondary" onClick={() => ctx.nav(id > 1 ? `unit/${id - 1}/learn` : 'map')}>← {id > 1 ? 'Unidad anterior' : 'Mi ruta'}</button>
        <button type="button" onClick={() => ctx.nav(id < 12 ? `unit/${id + 1}/learn` : 'final')}>{id < 12 ? 'Siguiente unidad' : 'Práctica final'} →</button>
      </div>
    </>
  )
}

function Aprende({ ctx, l }: { ctx: Ctx; l: Leccion }) {
  return (
    <div className="lesson-layout">
      <div>
        <div className="note"><b>Language focus</b><p style={{ margin: '8px 0 0' }}>{l.explain}</p></div>
        {l.groups.map((g) => (
          <section key={g.title}>
            <div className="section-head"><h3>{g.title}</h3><span className="muted">Toca una tarjeta para escuchar ↗</span></div>
            <div className="words">
              {g.words.map(([en, es]) => (
                <button type="button" key={en} className="word" onClick={() => ctx.speak(en.replace(' / ', ' or '))}>
                  <b>{en}</b><small>{es}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <aside>
        <div className="sidebox">
          <p className="eyebrow">TU MISIÓN</p>
          <h3>Make it yours.</h3>
          <p>{l.goal}</p>
          <p>1. Escucha las palabras.<br />2. Repítelas en voz alta.<br />3. Úsalas en una conversación.</p>
          <button type="button" onClick={() => ctx.nav(`unit/${l.id}/conversation`)}>Practicar conversación →</button>
        </div>
        <div className="panel">
          <p className="eyebrow">LLEVA TU LIBRO</p>
          <p className="muted">Puedes imprimir esta lección o guardarla como PDF desde tu navegador.</p>
          <button type="button" className="secondary" onClick={() => window.print()}>Imprimir lección</button>
        </div>
      </aside>
    </div>
  )
}

function Conversa({ ctx, l }: { ctx: Ctx; l: Leccion }) {
  const abiertas = ctx.libro.actividades.filter((a) => a.unitId === l.unitId && a.type === 'open_response').slice(0, 2)
  return (
    <div className="lesson-layout">
      <section className="panel">
        <p className="eyebrow">REAL-LIFE ENGLISH</p>
        <h2>Let’s connect.</h2>
        <p className="muted">Escucha el diálogo. Después, practica los papeles A y B con otra persona.</p>
        <div className="actions">
          <button type="button" onClick={() => ctx.speak(l.dialog.join(' '))}>▶ Escuchar diálogo</button>
          <button type="button" className="secondary" onClick={ctx.stop}>■ Detener</button>
        </div>
        <div className="dialogue">
          {l.dialog.map((line, i) => (
            <div key={i} className="bubble">
              <small>PERSON {i % 2 ? 'B' : 'A'}
                <button type="button" className="ghost" onClick={() => ctx.speak(line)} aria-label={`Escuchar frase ${i + 1}`}>♫</button>
              </small>
              {line}
            </div>
          ))}
        </div>
      </section>
      <aside>
        <div className="sidebox">
          <p className="eyebrow">YOUR TURN</p>
          <h3>Ahora, tú.</h3>
          <p>Cambia los ejemplos por tus propias ideas. Puedes usar datos ficticios.</p>
          {abiertas.map((a) => <p key={a.id}><b>{a.prompt}</b></p>)}
          <p className="muted">La práctica oral es libre; no se graba ni se califica automáticamente.</p>
        </div>
      </aside>
    </div>
  )
}

function Practica({ ctx, l }: { ctx: Ctx; l: Leccion }) {
  const abiertas = ctx.libro.actividades.filter((a) => a.unitId === l.unitId && a.type === 'open_response')
  const muestras = DICTADOS[l.id] || l.groups[0]?.words.slice(0, 5).map((w) => w[0]) || []
  const [escucha, setEscucha] = useState<Record<number, string>>({})
  return (
    <>
      <section className="panel">
        <p className="eyebrow">WRITE & REFLECT</p>
        <h2>Hazlo parte de tu vida.</h2>
        <p className="muted">Tus respuestas se guardan en tu cuenta y las puede revisar tu docente. No tienen calificación automática.</p>
        {abiertas.map((a) => <RespuestaAbierta key={a.id} ctx={ctx} act={a} />)}
      </section>
      <section className="listening">
        <p className="eyebrow">LISTENING LAB</p>
        <h3>Escucha y escribe.</h3>
        <p>Escucha cada muestra y escribe lo que entiendas. Luego compara con la transcripción.</p>
        {muestras.map((m, i) => (
          <div key={i} style={{ margin: '20px 0' }}>
            <button type="button" className="secondary" onClick={() => ctx.speak(m)}>♫ Muestra {i + 1}</button>
            <label htmlFor={`bk-listen-${i}`}>Tu respuesta</label>
            <input type="text" id={`bk-listen-${i}`} value={escucha[i] || ''} onChange={(e) => setEscucha((s) => ({ ...s, [i]: e.target.value }))} />
            <details><summary>Ver transcripción</summary><p>{m}</p></details>
          </div>
        ))}
      </section>
      {l.id === 10 && (
        <section className="panel">
          <h3>City practice</h3>
          <p>Mapa de práctica adaptado: los lugares de cada fila están uno junto al otro; los de una misma columna están enfrente, a lados opuestos de la calle.</p>
          <table className="table">
            <tbody>
              <tr><td>Library</td><td>School</td><td>Hospital</td></tr>
              <tr><th colSpan={3} style={{ textAlign: 'center', background: '#ece7f2' }}>MAIN STREET</th></tr>
              <tr><td>Bank</td><td>Gym</td><td>Post office</td></tr>
            </tbody>
          </table>
          <p>Where is the gym? Where is the library?</p>
          <details><summary>Respuestas de referencia</summary><p>The gym is opposite the school. It is between the bank and the post office. The library is opposite the bank and next to the school.</p></details>
        </section>
      )}
    </>
  )
}

function Evalua({ ctx, l }: { ctx: Ctx; l: Leccion }) {
  const ev = ctx.libro.evaluaciones.find((e) => e.id === `${l.unitId}-CHECKPOINT`)
  if (!ev) return null
  return (
    <>
      <p className="eyebrow">CHECKPOINT · UNIT {l.id}</p>
      <h2>Comprueba lo que aprendiste.</h2>
      <p>Responde las {ev.total} preguntas. Consigue al menos {ev.aprobarCon} aciertos para obtener tu sello. Puedes volver a intentarlo.</p>
      <Quiz ctx={ctx} ev={ev} />
    </>
  )
}

// ── Evaluación (calificada en el servidor) ────────────────────────────
function Quiz({ ctx, ev }: { ctx: Ctx; ev: Evaluacion }) {
  const [sel, setSel] = useState<Record<string, string>>({})
  const [requestId, setRequestId] = useState(nuevoRequestId)
  const [enviando, setEnviando] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const porAct = new Map((res?.resultados || []).map((r) => [r.activityId, r]))
  const esFinal = ev.id === FINAL_ID
  const previo = ctx.avance?.evaluaciones[ev.id]

  const comprobar = async () => {
    if (ctx.libro.preview) { ctx.toast('Vista previa: los intentos no se envían.'); return }
    if (ev.activityIds.some((id) => !sel[id])) { ctx.toast('Responde todas las preguntas antes de comprobar.'); return }
    setEnviando(true)
    try {
      const { data } = await post(`${API}/intento`, {
        assessmentId: ev.id,
        requestId,
        contentVersion: ctx.libro.version,
        answers: ev.activityIds.map((id) => ({ activityId: id, optionId: sel[id] })),
      })
      setRes(data)
      ctx.setAvance(data.avance)
    } catch (e: any) {
      ctx.toast(e.message)
    } finally {
      setEnviando(false)
    }
  }
  const reintentar = () => { setSel({}); setRes(null); setRequestId(nuevoRequestId()) }
  const score = res ? Math.round((100 * res.correctas) / res.total) : 0

  return (
    <>
      {previo && !res && <p className="muted">Mejor resultado: {pct(previo)}% · {previo.intentos} intento(s){previo.aprobado ? ' · ✓ aprobado' : ''}</p>}
      <div>
        {ev.activityIds.map((id, i) => {
          const a = ctx.actividades.get(id)
          if (!a) return null
          const r = porAct.get(id)
          return (
            <section key={id} className="question">
              <p><b>{i + 1}. {a.prompt}</b></p>
              <div className="options">
                {(a.options || []).map((o, j) => {
                  const elegida = sel[id] === o.id
                  const cls = ['option', elegida ? 'selected' : '', r && elegida ? (r.correcta ? 'correct' : 'wrong') : ''].join(' ')
                  return (
                    <button type="button" key={o.id} className={cls} disabled={!!res} aria-pressed={elegida}
                      onClick={() => setSel((s) => ({ ...s, [id]: o.id }))}>
                      {String.fromCharCode(65 + j)} · {o.text}
                    </button>
                  )
                })}
              </div>
              {r && <p className={`feedback ${r.correcta ? '' : 'bad'}`}>{r.correcta ? '✓ Correcto.' : '↺ Incorrecto.'} {r.explicacion || ''}</p>}
            </section>
          )
        })}
      </div>
      <div className="actions">
        <button type="button" onClick={comprobar} disabled={!!res || enviando || ctx.libro.preview}>
          {enviando ? 'Comprobando…' : 'Comprobar respuestas'}
        </button>
        <button type="button" className="secondary" onClick={reintentar}>Reintentar</button>
      </div>
      {res && (
        <div className="banner" role="status" aria-live="polite">
          <div>
            <div className="score">{score}%</div>
            <h3>{res.aprobado ? (esFinal ? '¡Reto final superado!' : '¡Sello conseguido!') : 'Sigue practicando.'}</h3>
            <p>{res.aprobado ? 'Tu resultado quedó guardado en tu cuenta.' : `Necesitas ${res.aprobarCon} aciertos. Revisa las explicaciones y vuelve a intentarlo.`}</p>
          </div>
          <button type="button" onClick={() => ctx.nav('passport')}>Ver mi pasaporte →</button>
        </div>
      )}
    </>
  )
}

// ── Respuesta escrita (se guarda sola en el servidor) ─────────────────
function RespuestaAbierta({ ctx, act }: { ctx: Ctx; act: Actividad }) {
  const inicial = ctx.libro.respuestas[act.id]
  const [texto, setTexto] = useState(inicial?.texto || '')
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const guardadoRef = useRef(inicial?.texto || '')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])
  const cambiar = (v: string) => {
    setTexto(v)
    if (ctx.libro.preview) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      const t = v.trim()
      if (!t || t === guardadoRef.current) return
      setEstado('guardando')
      try {
        await post(`${API}/respuesta`, { activityId: act.id, texto: t })
        guardadoRef.current = t
        setEstado('ok')
      } catch (e: any) {
        setEstado('error')
        ctx.toast(e.message)
      }
    }, 1200)
  }

  return (
    <div>
      <label htmlFor={`bk-${act.id}`}>{act.prompt}</label>
      <textarea id={`bk-${act.id}`} value={texto} maxLength={act.maxLength || 4000} disabled={ctx.libro.preview}
        placeholder="Write your answer in English…" onChange={(e) => cambiar(e.target.value)} />
      <span className="saved">
        {estado === 'guardando' ? 'Guardando…' : estado === 'ok' ? '✓ Guardado en tu cuenta' : estado === 'error' ? 'No se pudo guardar' : ''}
      </span>
      {inicial?.comentarioDocente && <p className="note" style={{ marginTop: 8 }}>Comentario de tu docente: {inicial.comentarioDocente}</p>}
    </div>
  )
}

// ── Práctica final ────────────────────────────────────────────────────
function FinalView({ ctx }: { ctx: Ctx }) {
  const abiertas = ctx.libro.actividades.filter((a) => a.id.startsWith(`${FINAL_ID}-W`))
  const ev = ctx.libro.evaluaciones.find((e) => e.id === FINAL_ID)
  const leer = () => {
    const t = abiertas.map((a) => (document.getElementById(`bk-${a.id}`) as HTMLTextAreaElement | null)?.value || '').join(' ')
    if (!t.trim()) { ctx.toast('Primero escribe tu presentación en inglés.'); return }
    ctx.speak(t)
  }
  return (
    <>
      <p className="eyebrow">FINAL PRACTICE</p>
      <h1 style={{ fontSize: 54 }}>All about you.</h1>
      <p>Une todo lo aprendido. Puedes usar un personaje ficticio para esta actividad.</p>
      <div className="panel">
        <h2>Mi presentación personal</h2>
        {abiertas.map((a) => <RespuestaAbierta key={a.id} ctx={ctx} act={a} />)}
        <div className="actions">
          <button type="button" onClick={leer}>♫ Escuchar mi presentación</button>
          <button type="button" className="secondary" onClick={() => window.print()}>Imprimir</button>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>Escritura y pronunciación: revisión con tu docente. No se califican automáticamente.</p>
      </div>
      <h2>El reto Essential</h2>
      <p>Una pregunta por unidad. Aprueba con {ev?.aprobarCon ?? 9} de {ev?.total ?? 12}.</p>
      {ev && <Quiz ctx={ctx} ev={ev} />}
    </>
  )
}

// ── Pasaporte ─────────────────────────────────────────────────────────
function PasaporteView({ ctx }: { ctx: Ctx }) {
  const fin = ctx.avance?.evaluaciones[FINAL_ID]
  return (
    <>
      <section className="passport">
        <div>
          <p className="eyebrow">LET’S GO SPEAK · LEARNING PASSPORT</p>
          <h1>Every step<br />counts.</h1>
          <p>Tu recorrido, tus logros, tus nuevas conexiones.</p>
          <p style={{ fontSize: 22, margin: '24px 0 8px' }}><b>{ctx.libro.alumno.nombre}</b></p>
          <p style={{ marginTop: 12 }}>
            {completadas(ctx)} / 12 sellos obtenidos<br />
            Reto final: {fin ? `${pct(fin)}%${fin.aprobado ? ' ✓' : ''}` : 'pendiente'}<br />
            Lectura del libro: {ctx.avance?.lectura.porcentaje ?? 0}%
          </p>
        </div>
        <div>
          <p className="eyebrow">DESTINATION · ESSENTIAL</p>
          <div className="stamps">
            {ctx.libro.lecciones.map((l) => {
              const ok = evalUnidad(ctx, l)?.aprobado
              return (
                <div key={l.id} className={`stamp ${ok ? 'earned' : ''}`} title={l.title}>
                  <b>{pad(l.id)}</b><span>{ok ? 'COMPLETE' : 'PENDING'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      <div className="actions">
        <button type="button" onClick={() => window.print()}>Imprimir pasaporte</button>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>Tu avance se guarda en tu cuenta de Let’s Go Speak, en cualquier dispositivo. Este pasaporte registra práctica; no es un certificado oficial.</p>
      {ctx.avance?.completado ? (
        <div className="banner">
          <div><p className="eyebrow">ESSENTIAL EXPLORER</p><h2>You made it!</h2><p>Completaste las 12 unidades y el reto final. Tu insignia de logro: Essential Explorer.</p></div>
          <span style={{ fontSize: 64 }}>✦</span>
        </div>
      ) : completadas(ctx) === 12 ? (
        <div className="banner"><div><h3>12/12 unidades; reto final pendiente</h3><p>Supera el reto final para obtener la insignia Essential Explorer.</p></div>
          <button type="button" onClick={() => ctx.nav('final')}>Ir al reto final →</button></div>
      ) : null}
    </>
  )
}

// ── Recursos ──────────────────────────────────────────────────────────
function RecursosView({ ctx }: { ctx: Ctx }) {
  const abrirPdf = async (descargar: boolean) => {
    const w = descargar ? null : window.open('', '_blank')
    try {
      const { url } = await api<{ url: string }>(`${API}/pdf${descargar ? '?download=1' : ''}`)
      if (w) w.location.href = url
      else window.location.href = url
    } catch (e: any) {
      w?.close()
      ctx.toast(e.message)
    }
  }
  return (
    <>
      <p className="eyebrow">RECURSOS & GUÍA</p>
      <h1 style={{ fontSize: 52 }}>Todo para tu viaje.</h1>
      <div className="banner">
        <div><h3>Student’s Book · Edición revisada</h3><p>88 páginas con las correcciones aplicadas, sin claves de respuesta.</p></div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" onClick={() => ctx.nav('libro')}>Leer el libro</button>
          <button type="button" className="secondary" onClick={() => abrirPdf(false)}>Ver PDF</button>
          <button type="button" className="secondary" onClick={() => abrirPdf(true)}>Descargar PDF ↓</button>
        </div>
      </div>
      <section className="panel">
        <h2>Cómo usar el libro</h2>
        <p><b>Aprende:</b> vocabulario bilingüe y explicaciones. <b>Conversa:</b> diálogos con lectura en voz alta. <b>Practica:</b> escritura y escucha. <b>Evalúate:</b> preguntas con corrección inmediata. <b>Libro:</b> las páginas de la unidad.</p>
        <p>Se obtiene un sello por unidad con al menos 3 de 4 aciertos. El reto final incluye una pregunta de cada unidad y se aprueba con 9 de 12. Las respuestas abiertas las revisa tu docente.</p>
        <p>La síntesis de voz necesita una voz en inglés instalada y puede variar entre dispositivos. Se prioriza Microsoft Zira. No se incluye reconocimiento de voz.</p>
        <p>Tu avance, tus respuestas y tus sellos se guardan en tu cuenta: puedes continuar desde cualquier dispositivo.</p>
      </section>
      <section className="panel">
        <p className="eyebrow">REVISIÓN EDITORIAL</p>
        <h2>Correcciones y adaptaciones aplicadas</h2>
        <p>Referencia por página física del PDF original, contando la portada como página 1.</p>
        <table className="table">
          <thead><tr><th>Páginas</th><th>Hallazgo</th><th>Versión interactiva</th></tr></thead>
          <tbody>
            {EDITORIAL.map(([p, h, v]) => <tr key={p}><td>{p}</td><td>{h}</td><td>{v}</td></tr>)}
          </tbody>
        </table>
      </section>
      <details>
        <summary>Guía para docentes y alcance de la adaptación</summary>
        <p>Se mantienen los temas y vocabulario de las 12 unidades. Las prácticas interactivas son adaptaciones, no transcripciones literales de todos los ejercicios visuales. Los cuatro reactivos de cada unidad y el reto final son ejercicios nuevos de refuerzo.</p>
        <p>Para trabajo oral, valorar inteligibilidad, vocabulario de la unidad y uso de estructuras. En escritura, revisar significado, orden y forma verbal. Las puntuaciones solo corresponden a respuestas de selección.</p>
      </details>
      <details>
        <summary>Créditos del material de origen</summary>
        <p>Let’s Go Speak · ESSENTIAL Student’s Book.<br />Contents: Paulina del Rocío Herrera.<br />Project manager: Miguel Ángel Martínez.<br />Design &amp; layout: Ignacio Escudero y Héctor Barraza.<br />Illustration: Javier Mejía.</p>
        <p>Fotografías e ilustraciones: extraídas del PDF proporcionado por LGS. Adaptación interactiva y revisión editorial preparada a solicitud de LGS.</p>
      </details>
    </>
  )
}

function LibroCompletoView({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <div className="breadcrumbs"><a href="#resources">Recursos</a> / Libro completo</div>
      <p className="eyebrow">STUDENT’S BOOK · EDICIÓN REVISADA</p>
      <h2>LGS ESSENTIAL</h2>
      <VisorPaginas ctx={ctx} paginas={ctx.libro.paginas} titulo="Libro completo" />
    </>
  )
}

// ── Visor de páginas (URL firmada + lectura tras 5 s) ─────────────────
function VisorPaginas({ ctx, paginas, titulo }: { ctx: Ctx; paginas: Pagina[]; titulo: string }) {
  const [idx, setIdx] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [cargada, setCargada] = useState(false)
  const reintento = useRef<Set<string>>(new Set())
  const touchX = useRef<number | null>(null)
  const p = paginas[idx]

  const pedir = useCallback(async (pg: Pagina, forzar = false) => {
    try {
      const { url } = await api<{ url: string }>(`${API}/pagina?id=${encodeURIComponent(pg.id)}`)
      setUrls((u) => (forzar || !u[pg.id] ? { ...u, [pg.id]: url } : u))
    } catch (e: any) { ctx.toast(e.message) }
  }, [ctx])

  useEffect(() => {
    if (!p) return
    setCargada(false)
    if (!urls[p.id]) pedir(p)
    const sig = paginas[idx + 1]
    if (sig && !urls[sig.id]) pedir(sig)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id])

  // Lectura: 5 s acumulados con la pestaña visible y la imagen cargada.
  useEffect(() => {
    if (!p || !cargada || ctx.libro.preview || ctx.vistasRef.current.has(p.id)) return
    let acumulado = 0
    let ultimo = Date.now()
    const t = window.setInterval(() => {
      const ahora = Date.now()
      if (document.visibilityState === 'visible') acumulado += ahora - ultimo
      ultimo = ahora
      if (acumulado >= VISTA_MS) {
        window.clearInterval(t)
        ctx.vistasRef.current.add(p.id)
        post(`${API}/vista`, { pageId: p.id })
          .then(({ lectura }) => ctx.setAvance((a) => (a ? { ...a, lectura } : a)))
          .catch(() => ctx.vistasRef.current.delete(p.id))
      }
    }, 500)
    return () => window.clearInterval(t)
  }, [p, cargada, ctx])

  if (!p) return <p className="muted">No hay páginas para mostrar.</p>
  const ir = (n: number) => setIdx(Math.max(0, Math.min(paginas.length - 1, n)))
  return (
    <section className="panel">
      <div className="bookbar">
        <button type="button" className="secondary" onClick={() => ir(idx - 1)} disabled={idx === 0}>← Anterior</button>
        <div style={{ textAlign: 'center' }}>
          <b>{p.title}</b>
          <div className="muted">{titulo} · página {p.page} de 88 ({idx + 1}/{paginas.length}){ctx.vistasRef.current.has(p.id) && !ctx.libro.preview ? ' · leída' : ''}</div>
        </div>
        <button type="button" onClick={() => ir(idx + 1)} disabled={idx === paginas.length - 1}>Siguiente →</button>
      </div>
      <div
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 50) ir(dx < 0 ? idx + 1 : idx - 1)
          touchX.current = null
        }}
      >
        {urls[p.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} className="bookpage" src={urls[p.id]} alt={`Página ${p.page}: ${p.title}`} draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoad={() => { setCargada(true); reintento.current.delete(p.id) }}
            onError={() => { if (!reintento.current.has(p.id)) { reintento.current.add(p.id); pedir(p, true) } }} />
        ) : <p className="muted" style={{ textAlign: 'center', padding: '80px 0' }}>Cargando página…</p>}
      </div>
    </section>
  )
}

const EDITORIAL: [string, string, string][] = [
  ['3–4, varias', 'Numeración de contenidos y pies de página inconsistentes.', 'Navegación unificada en 12 unidades y práctica final.'],
  ['6–9', 'Puntuación de diálogos y uso de saludos.', 'Se normalizan comas, contracciones y “Nice to meet you, too”; se distingue good evening de good night.'],
  ['12–14', 'La regla de fechas presenta una sola variante; la instrucción del ejercicio 1 no corresponde a sus preguntas.', 'Se explican formatos estadounidense y británico y se pide responder preguntas personales.'],
  ['16–19', 'Terminología de profesiones.', 'Police officer como término inclusivo; práctica de a/an y respuestas con be.'],
  ['21–23', 'Nacionalidades y variaciones.', 'Se admiten Argentine/Argentinian y Salvadoran/Salvadorian; se distinguen England y United Kingdom.'],
  ['25–27', '“How’s the weather like…” en vez de una pregunta completa; climas ligados a fotos.', '“What is the weather like…?”; se evalúan descripciones, sin presentar climas de ejemplo como datos actuales.'],
  ['29–31', 'Grafías y orden de descripciones.', 'T-shirt; gray/grey; color antes de la prenda y be + wearing.'],
  ['33–35', '“How many brothers or sisters you have?” y “Do you have sons or daughters?”', '“How many brothers or sisters do you have?” y uso natural de any; mother-in-law y otras relaciones con guiones.'],
  ['37–40', 'Singular/plural: “Hands & Finger”; “Sore thorat”.', 'Sore throat, hand/finger y plurales coherentes; foot/feet y tooth/teeth.'],
  ['42–46', '“A quater”, “twenty five” y pies de página inconsistentes.', 'A quarter, watch TV, twenty-five; práctica de horas con respuestas inequívocas.'],
  ['49–52', '“How do I get to themuseum?” y mapa de baja legibilidad.', '“How do I get to the museum?” y un mapa de práctica textual con posiciones explícitas.'],
  ['54–57', '“Forniture”, “Coffe maker” y “Rice cocker”.', 'Furniture, coffee maker y rice cooker; clasificación por habitación y distinción de muebles, instalaciones y electrodomésticos.'],
  ['59–63', '“Write the number front the correct picture”; instrucciones bilingües poco claras y adjetivos valorativos.', 'Preguntas completas, instrucción clara y descripciones neutrales.'],
  ['9, 14, 62', 'Ejercicios de escucha sin archivos de audio adjuntos.', 'Muestras de voz sintetizada y transcripciones visibles.'],
]
