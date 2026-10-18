'use client'

/**
 * /panel-estudiante/book-new/[slug] — New Books v2: Book BEG / PRA / FUNC New.
 *
 * Mismo diseño y recorrido que el prototipo entregado con los libros
 * (Explorar · Mi ruta · Libro · Mi progreso · Recursos; cada step con Story
 * time / Reading / Práctica / Checkpoint / Páginas / Reading Plus), integrado a LGS:
 *  - Todo llega de /api/postgres/panel-estudiante/libro-v2/[slug]/* (sesión +
 *    alumno activo de la etapa + interruptor). Páginas, retratos y PDF = URLs firmadas.
 *  - Checkpoints calificados en el SERVIDOR (el cliente nunca recibe la clave);
 *    intentos, lecturas y respuestas se guardan en la cuenta del alumno.
 *  - Página leída tras 5 s visible. Voz = síntesis del navegador (sin MP3).
 *  - SUPER_ADMIN/ADMIN: vista previa de solo lectura.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { BOOK_V2_CSS } from './book-v2.css'

// ── Tipos ──────────────────────────────────────────────────────────────
interface Pagina { page: number; id: string; stepNumber: number | null; kind: string; title: string }
interface Actividad { id: string; stepNumber: number; type: 'single_choice' | 'open_response'; prompt: string; options?: { id: string; text: string }[]; maxLength?: number; title?: string }
interface Checkpoint { id: string; stepNumber: number; activityIds: string[]; minimo: number; total: number; kind: 'core' | 'jump' | 'final' | 'plus'; required: boolean }
interface Episodio { step: number; title: string; time: string; characters: string[]; dialogue: { speaker: string; text: string }[]; reading: string; focus: string; task: string }
interface EvalAv { mejor: number; total: number; aprobado: boolean; intentos: number }
interface Avance {
  paginasVistas: string[]
  evaluaciones: Record<string, EvalAv>
  aprobados: number
  totalRequeridos: number
  completado: boolean
  respuestasGuardadas: number
  historial: { assessmentId: string; step: number | null; plus: boolean; correctas: number; total: number; aprobado: boolean; creadoEn: string }[]
}
interface Libro {
  slug: string; bookCode: string; version: string; level: string; headline: string; intro: string
  accent: string; secondary: string; paper: string; preview: boolean; flagActivo: boolean
  alumno: { nombre: string }
  personajes: Record<string, string>
  steps: number[]; paginas: Pagina[]; actividades: Actividad[]; checkpoints: Checkpoint[]
  episodios: Episodio[]; extensiones: Record<string, { title: string; text: string }>
  avance: Avance | null
  respuestas: Record<string, { texto: string; comentarioDocente: string | null }>
}

const HERO_CHARS = ['Clarice', 'Ethan', 'Sara', 'Taylor', 'Denali', 'Maria']

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) throw new Error(json?.error || 'No se pudo completar la operación. Inténtalo de nuevo.')
  return json
}
const post = (url: string, body: any) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
function nuevoRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
function leerLocal(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function escribirLocal(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* sin storage */ } }

// ── Voz del navegador (Web Speech API) ────────────────────────────────
function useVoz(toast: (t: string) => void) {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([])
  const [voz, setVozState] = useState('')
  const [rate, setRateState] = useState(0.85)
  const cargar = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    const v = window.speechSynthesis.getVoices().filter((x) => /^en(-|_)/i.test(x.lang))
    setVoces(v)
    return v
  }, [])
  useEffect(() => {
    const g = leerLocal('lgs-v2-voz'); const r = Number(leerLocal('lgs-v2-rate'))
    if (g) setVozState(g)
    if (r >= 0.6 && r <= 1.1) setRateState(r)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) { window.speechSynthesis.onvoiceschanged = () => cargar(); cargar() }
  }, [cargar])
  const elegida = useMemo(() => voces.find((v) => v.name === voz) || voces.find((v) => /zira/i.test(v.name)) || voces[0], [voces, voz])
  const speak = useCallback((t: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { toast('Activa una voz en inglés en tu dispositivo para escuchar.'); return }
    const v = voces.length ? voces : cargar()
    if (!v.length) { toast('Activa una voz en inglés en tu dispositivo para escuchar.'); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(t)
    u.voice = elegida || v[0]; u.lang = u.voice.lang; u.rate = rate
    u.onerror = (e: any) => { if (!['canceled', 'interrupted'].includes(e.error)) toast('No se pudo reproducir la voz.') }
    window.speechSynthesis.speak(u)
  }, [voces, elegida, rate, cargar, toast])
  const stop = useCallback(() => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  return {
    voces, elegida, rate, speak, stop, cargar,
    setVoz: (n: string) => { setVozState(n); escribirLocal('lgs-v2-voz', n) },
    setRate: (r: number) => { setRateState(r); escribirLocal('lgs-v2-rate', String(r)) },
  }
}

const nav = (h: string) => { window.location.hash = h }

// ── Página ────────────────────────────────────────────────────────────
export default function BookNewPage() {
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || '')
  const API = `/api/postgres/panel-estudiante/libro-v2/${slug}`
  const [D, setD] = useState<Libro | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [avance, setAvance] = useState<Avance | null>(null)
  const [ruta, setRuta] = useState('home')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [audioOpen, setAudioOpen] = useState(false)
  const leidasRef = useRef<Set<string>>(new Set())
  const ultimaRecarga = useRef(0)

  const toast = useCallback((t: string) => {
    setToastMsg(t)
    window.clearTimeout((window as any).__b2Toast)
    ;(window as any).__b2Toast = window.setTimeout(() => setToastMsg(null), 5000)
  }, [])
  const voz = useVoz(toast)

  useEffect(() => {
    api<{ data: Libro }>(API)
      .then(({ data }) => {
        setD(data); setAvance(data.avance)
        leidasRef.current = new Set(data.avance?.paginasVistas || [])
        document.title = `LGS · ${data.level}`
      })
      .catch((e) => setError(e.message))
  }, [API])

  const refrescarRetratos = useCallback(() => {
    if (Date.now() - ultimaRecarga.current < 60_000) return
    ultimaRecarga.current = Date.now()
    api<{ data: Libro }>(API).then(({ data }) => setD((d) => (d ? { ...d, personajes: data.personajes } : d))).catch(() => {})
  }, [API])

  useEffect(() => {
    const leer = () => { setRuta(window.location.hash.slice(1) || 'home'); voz.stop(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    leer()
    window.addEventListener('hashchange', leer)
    return () => window.removeEventListener('hashchange', leer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { speak, stop } = voz
  const ctx: Ctx | null = useMemo(() => (D ? { D, API, avance, setAvance, toast, speak, stop, leidasRef, refrescarRetratos } : null),
    [D, API, avance, toast, speak, stop, refrescarRetratos])

  let vista: React.ReactNode = null
  if (ctx) {
    if (ruta.startsWith('step/')) vista = <StepView key={ruta} ctx={ctx} s={Number(ruta.split('/')[1])} />
    else if (ruta === 'route') vista = <RouteView ctx={ctx} />
    else if (ruta === 'progress') vista = <ProgressView ctx={ctx} />
    else if (ruta === 'resources') vista = <ResourcesView ctx={ctx} />
    else if (ruta === 'book') vista = <><p className="eyebrow">THE COMPLETE BOOK</p><h1>{D!.level}.</h1><Visor key="book" ctx={ctx} step={null} /></>
    else vista = <HomeView ctx={ctx} />
  }

  const estilo = D ? ({ '--paper': D.paper, '--secondary': D.secondary } as React.CSSProperties) : undefined
  return (
    <div className="b2" style={estilo}>
      <style dangerouslySetInnerHTML={{ __html: BOOK_V2_CSS }} />
      <header className="b2-top">
        <a href="#home" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/books/ess/logo.png" alt="Let's Go Speak" />
          <span>{D?.level || 'LGS'}<small>YOUR ENGLISH JOURNEY</small></span>
        </a>
        <nav aria-label="Principal">
          <a href="/panel-estudiante">← Mi panel</a>
          <a href="#home" className={ruta === 'home' ? 'on' : ''}>Explorar</a>
          <a href="#route" className={ruta === 'route' ? 'on' : ''}>Mi ruta</a>
          <a href="#book" className={ruta === 'book' ? 'on' : ''}>Libro</a>
          <a href="#progress" className={ruta === 'progress' ? 'on' : ''}>Mi progreso</a>
          <a href="#resources" className={ruta === 'resources' ? 'on' : ''}>Recursos</a>
          <button type="button" className="quiet" onClick={() => { voz.cargar(); setAudioOpen(true) }}>♫ Voz</button>
        </nav>
      </header>
      {D?.preview ? (
        <div className="preview">
          Vista previa de administrador: puedes recorrer todo el libro, pero no se guardan intentos, lecturas ni respuestas.
          {!D.flagActivo && ' El interruptor está apagado: los alumnos aún no lo ven.'}
        </div>
      ) : (
        <div className="notice">Tu avance en este libro se guarda en tu cuenta de Let’s Go Speak. No cambia tu nivel ni tu historial académico.</div>
      )}
      <main>
        {error && !D && (
          <div className="panel">
            <h1>No pudimos abrir el libro.</h1>
            <p>{error}</p>
            <a className="button" href="/panel-estudiante">← Volver a mi panel</a>
          </div>
        )}
        {!D && !error && <p className="loading">Abriendo tu libro…</p>}
        {vista}
      </main>
      <footer className="b2-foot">
        <b>LET&apos;S GO SPEAK</b>
        <span>Learn. Connect. Go further.</span>
        <span>{D ? `${D.level} · Edición revisada` : ''}</span>
      </footer>

      {audioOpen && (
        <div className="modal-bg" onClick={() => setAudioOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Voz" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close" onClick={() => setAudioOpen(false)} aria-label="Cerrar">×</button>
            <p className="eyebrow">LISTEN &amp; REPEAT</p>
            <h2>Una voz para practicar.</h2>
            <p>Se selecciona Microsoft Zira si está disponible. Es voz sintetizada del dispositivo; no son audios grabados.</p>
            <label htmlFor="b2-voice">Voz en inglés</label>
            <select id="b2-voice" value={voz.elegida?.name || ''} onChange={(e) => voz.setVoz(e.target.value)}>
              {voz.voces.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
            <label htmlFor="b2-rate">Velocidad {voz.rate.toFixed(2)}</label>
            <input id="b2-rate" type="range" min={0.6} max={1.1} step={0.05} value={voz.rate} onChange={(e) => voz.setRate(Number(e.target.value))} />
            <button type="button" onClick={() => voz.speak('Let’s go speak. Every story starts with a conversation.')}>Escuchar ejemplo</button>{' '}
            <button type="button" className="secondary" onClick={voz.stop}>Detener</button>
            <p style={{ marginTop: 16 }}>{voz.voces.length ? 'Voces instaladas en este dispositivo.' : 'No hay una voz en inglés disponible en este dispositivo.'}</p>
          </div>
        </div>
      )}
      {toastMsg && <div className="toast" role="status" aria-live="polite">{toastMsg}</div>}
    </div>
  )
}

// ── Contexto + helpers del prototipo ──────────────────────────────────
interface Ctx {
  D: Libro
  API: string
  avance: Avance | null
  setAvance: React.Dispatch<React.SetStateAction<Avance | null>>
  toast: (t: string) => void
  speak: (t: string) => void
  stop: () => void
  leidasRef: React.MutableRefObject<Set<string>>
  refrescarRetratos: () => void
}
const episodio = (c: Ctx, s: number) => c.D.episodios.find((e) => e.step === s)
const checkpoint = (c: Ctx, s: number) => c.D.checkpoints.find((x) => x.stepNumber === s && x.kind !== 'plus')
const plus = (c: Ctx, s: number) => c.D.checkpoints.find((x) => x.stepNumber === s && x.kind === 'plus')
const pctDe = (e?: EvalAv) => (e && e.total ? Math.round((100 * e.mejor) / e.total) : 0)
const best = (c: Ctx, s: number) => { const cp = checkpoint(c, s); return cp ? pctDe(c.avance?.evaluaciones[cp.id]) : 0 }
const aprobado = (c: Ctx, s: number) => { const cp = checkpoint(c, s); return !!(cp && c.avance?.evaluaciones[cp.id]?.aprobado) }
const passed = (c: Ctx) => c.avance?.aprobados ?? 0
const total = (c: Ctx) => c.avance?.totalRequeridos ?? c.D.checkpoints.filter((x) => x.required).length
const readCount = (c: Ctx) => c.leidasRef.current.size

function Retrato({ c, n }: { c: Ctx; n: string }) {
  const src = c.D.personajes[n]
  if (!src) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={n} onError={c.refrescarRetratos} />
}

function Card({ c, s }: { c: Ctx; s: number }) {
  const e = episodio(c, s)
  const score = best(c, s)
  const ok = aprobado(c, s)
  const ultimo = s === c.D.steps[c.D.steps.length - 1]
  return (
    <a className="card" href={`#step/${s}`}>
      <div className="cardTop"><span className="tag">STEP {s}</span><Retrato c={c} n={e?.characters[0] || 'Sara'} /></div>
      <h3>{e?.title || (ultimo ? 'Final story challenge' : 'Story checkpoint')}</h3>
      <p>{e?.focus || 'Conecta los episodios y comprueba lo que has aprendido.'}</p>
      <div className="go"><span className={ok ? 'passed' : ''}>{ok ? '✓ Aprobado' : score ? `Mejor nota: ${score}%` : 'Empezar'}</span><span>↗</span></div>
    </a>
  )
}

// ── Explorar ──────────────────────────────────────────────────────────
function HomeView({ ctx: c }: { ctx: Ctx }) {
  const siguiente = c.D.steps.find((s) => !aprobado(c, s)) || c.D.steps[0]
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">LET’S GO SPEAK · {c.D.level}</p>
          <h1 dangerouslySetInnerHTML={{ __html: c.D.headline }} />
          <p className="intro">{c.D.intro} Sigue a los personajes, practica a tu ritmo y convierte cada step en una conversación.</p>
          <div className="actions">
            <a className="button" href={`#step/${siguiente}`}>Continuar mi viaje →</a>
            <a className="button secondary" href="#book">Abrir el libro completo</a>
          </div>
          <span className="pill">{c.D.paginas.length} páginas</span>
          <span className="pill">12 episodios conectados</span>
          <span className="pill">75% para aprobar</span>
        </div>
        <div className="heroArt">
          {HERO_CHARS.map((n) => <figure key={n}><Retrato c={c} n={n} /><figcaption>{n}</figcaption></figure>)}
          <div className="sticker">REAL STORIES<br /><b>REAL ENGLISH</b></div>
        </div>
      </section>
      <section className="stats">
        <div><strong>{passed(c)} / {total(c)}</strong><span>Checkpoints aprobados</span></div>
        <div><strong>{readCount(c)}</strong><span>Páginas leídas</span></div>
        <div><strong>{c.avance?.historial.length ?? 0}</strong><span>Intentos registrados</span></div>
      </section>
      <div className="sectionHead">
        <div><p className="eyebrow">YOUR NEXT CHAPTER</p><h2>Una historia. Muchas formas de aprender.</h2></div>
        <a href="#route">Ver mi ruta completa ↗</a>
      </div>
      <div className="grid">{c.D.steps.slice(0, 3).map((s) => <Card key={s} c={c} s={s} />)}</div>
      <div className="banner">
        <div><h3>Tu esfuerzo también cuenta.</h3><p>Repite los retos, conserva tus intentos y consulta tu mejor nota.</p></div>
        <a className="button secondary" href="#progress">Ver mi progreso →</a>
      </div>
    </>
  )
}

// ── Mi ruta ───────────────────────────────────────────────────────────
function RouteView({ ctx: c }: { ctx: Ctx }) {
  return (
    <>
      <p className="eyebrow">YOUR LEARNING ROUTE</p>
      <h1>Step by step.</h1>
      <p className="muted">Lee, escucha, practica y completa el checkpoint. Cada historia tiene una lectura que cuenta los mismos acontecimientos.</p>
      <div className="stats">
        <div><strong>{passed(c)} / {total(c)}</strong><span>Aprobados</span></div>
        <div><strong>{Math.round((passed(c) / Math.max(1, total(c))) * 100)}%</strong><span>Ruta completada</span></div>
        <div><strong>75%</strong><span>Nota mínima</span></div>
      </div>
      <div className="grid">{c.D.steps.map((s) => <Card key={s} c={c} s={s} />)}</div>
    </>
  )
}

// ── Step ──────────────────────────────────────────────────────────────
function StepView({ ctx: c, s }: { ctx: Ctx; s: number }) {
  const e = episodio(c, s)
  const cp = checkpoint(c, s)
  const ext = c.D.extensiones[String(s)]
  const tabs: [string, string][] = e
    ? [['story', 'Story time'], ['reading', 'Reading'], ['practice', 'Práctica'], ['quiz', 'Checkpoint'], ['pages', 'Páginas'], ...(ext ? [['plus', 'Reading Plus'] as [string, string]] : [])]
    : [['quiz', 'Checkpoint'], ['pages', 'Páginas']]
  const [tab, setTab] = useState(tabs[0][0])
  const cambiar = (t: string) => { c.stop(); setTab(t) }
  if (!cp) return <><h1>Step no disponible</h1><a href="#route">Volver a la ruta</a></>
  const i = c.D.steps.indexOf(s)
  const tareas = c.D.actividades.filter((a) => a.stepNumber === s && a.type === 'open_response' && !a.id.includes('-PLUS-'))

  return (
    <>
      <div className="breadcrumb"><a href="#route">← Mi ruta</a> / STEP {s}</div>
      <div className="unitHead">
        <div>
          <p className="eyebrow">{c.D.level} · STEP {s}</p>
          <h1>{e?.title || 'Story checkpoint'}</h1>
          <p className="muted">{e?.focus || 'Repaso de los episodios anteriores'} · Mejor nota: {best(c, s)}%</p>
        </div>
        <Retrato c={c} n={e?.characters[0] || 'Sara'} />
      </div>
      <div className="tabs">
        {tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => cambiar(id)}>{label}</button>)}
      </div>
      <div className="panel">
        {tab === 'story' && e && (
          <>
            <p className="eyebrow">{e.time}</p>
            <div className="actions">
              <button type="button" onClick={() => c.speak(e.dialogue.map((l) => `${l.speaker}. ${l.text}`).join(' '))}>♫ Escuchar diálogo</button>
              <button type="button" className="secondary" onClick={c.stop}>Detener</button>
            </div>
            {e.dialogue.map((l, k) => (
              <div key={k} className="dialogLine"><Retrato c={c} n={l.speaker} /><div><b>{l.speaker}</b><p>{l.text}</p></div></div>
            ))}
            <div className="focus"><b>LANGUAGE FOCUS</b><p>{e.focus}</p></div>
          </>
        )}
        {tab === 'reading' && e && (
          <>
            <p className="eyebrow">READING &amp; COMPREHENSION</p>
            <h2>{e.title}</h2>
            <button type="button" onClick={() => c.speak(e.reading)}>♫ Escuchar lectura</button>
            <p className="reading">{e.reading}</p>
            <div className="focus">
              <b>STORY DETECTIVE</b>
              <p>Who? Where? When? What changes? Busca evidencia antes de responder.</p>
              <button type="button" onClick={() => cambiar('quiz')}>Ir al checkpoint →</button>
            </div>
          </>
        )}
        {tab === 'quiz' && <Quiz c={c} cp={cp} />}
        {tab === 'practice' && <Practica c={c} tareas={tareas} />}
        {tab === 'pages' && <Visor key={`s${s}`} ctx={c} step={s} />}
        {tab === 'plus' && ext && (
          <>
            <p className="eyebrow">AN EXTENSION OF THE SAME EPISODE</p>
            <h2>{ext.title}</h2>
            <button type="button" onClick={() => c.speak(ext.text)}>♫ Escuchar</button>
            <p className="reading">{ext.text}</p>
            {plus(c, s) && <Quiz c={c} cp={plus(c, s)!} esPlus />}
          </>
        )}
      </div>
      <div className="actions">
        {i > 0 && <a className="button secondary" href={`#step/${c.D.steps[i - 1]}`}>← Step {c.D.steps[i - 1]}</a>}
        {i < c.D.steps.length - 1 && <a className="button secondary" href={`#step/${c.D.steps[i + 1]}`}>Step {c.D.steps[i + 1]} →</a>}
      </div>
    </>
  )
}

// ── Checkpoint (calificado en el servidor) ────────────────────────────
function Quiz({ c, cp, esPlus = false }: { c: Ctx; cp: Checkpoint; esPlus?: boolean }) {
  const [sel, setSel] = useState<Record<string, string>>({})
  const [requestId, setRequestId] = useState(nuevoRequestId)
  const [enviando, setEnviando] = useState(false)
  const [res, setRes] = useState<{ correctas: number; total: number; aprobado: boolean; score: number; detalles: { activityId: string; correcta: boolean }[] } | null>(null)
  const acts = cp.activityIds.map((id) => c.D.actividades.find((a) => a.id === id)).filter(Boolean) as Actividad[]

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (c.D.preview) { c.toast('Vista previa: los intentos no se guardan.'); return }
    if (acts.some((a) => !sel[a.id])) { c.toast('Elige una respuesta por pregunta.'); return }
    setEnviando(true)
    try {
      const { data } = await post(`${c.API}/intento`, {
        checkpointId: cp.id, requestId, contentVersion: c.D.version,
        answers: acts.map((a) => ({ activityId: a.id, optionId: sel[a.id] })),
      })
      setRes(data)
      c.setAvance(data.avance)
    } catch (e: any) {
      c.toast(e.message)
    } finally {
      setEnviando(false)
    }
  }
  const otraVez = () => { setSel({}); setRes(null); setRequestId(nuevoRequestId()) }

  return (
    <form onSubmit={enviar}>
      <p className="eyebrow">{esPlus ? 'READING PLUS · PRÁCTICA OPCIONAL' : cp.kind === 'jump' ? 'JUMP · 75% PARA APROBAR' : 'CHECKPOINT · 75% PARA APROBAR'}</p>
      <h2>{esPlus ? 'Comprende un poco más.' : 'Comprueba tu comprensión.'}</h2>
      <p className="muted">Elige una respuesta por pregunta. Cada intento se guarda; puedes volver a intentarlo.</p>
      {acts.map((a, i) => (
        <fieldset key={a.id} className="question">
          <legend>{i + 1}. {a.prompt}</legend>
          {(a.options || []).map((o) => (
            <label key={o.id} className="option">
              <input type="radio" name={a.id} value={o.id} checked={sel[a.id] === o.id} disabled={!!res}
                onChange={() => setSel((s) => ({ ...s, [a.id]: o.id }))} />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <button type="submit" disabled={enviando || !!res || c.D.preview}>{enviando ? 'Guardando…' : 'Comprobar y guardar'}</button>
      <div role="status" aria-live="polite">
        {res && (
          <div className={`result ${res.aprobado ? '' : 'fail'}`}>
            <h3>{res.score}% · {res.correctas} de {res.total}</h3>
            <p>{res.aprobado ? '¡Buen trabajo! Has superado este reto.' : 'Revisa la lectura y vuelve a intentarlo.'} Intento guardado.</p>
            <p>{res.detalles.map((d, k) => `${k + 1}: ${d.correcta ? '✓' : 'Revisar'}`).join(' · ')}</p>
            <button type="button" onClick={otraVez}>Intentar de nuevo</button>
          </div>
        )}
      </div>
    </form>
  )
}

// ── Práctica (respuestas abiertas) ────────────────────────────────────
function Practica({ c, tareas }: { c: Ctx; tareas: Actividad[] }) {
  const [id, setId] = useState(tareas[0]?.id || '')
  const a = tareas.find((t) => t.id === id)
  return (
    <>
      <p className="eyebrow">WRITE • THINK • SPEAK</p>
      <h2>Practica con los personajes.</h2>
      <p className="muted">Elige una tarea. Las actividades de las páginas originales se resuelven consultando el visor.</p>
      {tareas.length ? (
        <>
          <label htmlFor="b2-task">Actividad</label>
          <select id="b2-task" value={id} onChange={(e) => setId(e.target.value)}>
            {tareas.map((t) => <option key={t.id} value={t.id}>{t.title || t.id}</option>)}
          </select>
          {a && <Tarea key={a.id} c={c} a={a} />}
        </>
      ) : <p>No hay tareas abiertas en este step.</p>}
    </>
  )
}

function Tarea({ c, a }: { c: Ctx; a: Actividad }) {
  const inicial = c.D.respuestas[a.id]
  const [texto, setTexto] = useState(inicial?.texto || '')
  const [guardando, setGuardando] = useState(false)
  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (c.D.preview) { c.toast('Vista previa: las respuestas no se guardan.'); return }
    setGuardando(true)
    try {
      const r = await post(`${c.API}/respuesta`, { activityId: a.id, texto })
      c.D.respuestas[a.id] = { texto: texto.trim(), comentarioDocente: inicial?.comentarioDocente ?? null }
      c.setAvance((av) => (av ? { ...av, respuestasGuardadas: r.respuestasGuardadas } : av))
      c.toast('Respuesta guardada. No tiene nota automática.')
    } catch (e: any) {
      c.toast(e.message)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <form className="task" onSubmit={guardar}>
      <h3>{a.title || 'Tu turno'}</h3>
      <p>{a.prompt}</p>
      <label htmlFor={`b2-${a.id}`}>Tu respuesta</label>
      <textarea id={`b2-${a.id}`} maxLength={a.maxLength || 6000} required value={texto} placeholder="Write your answer here…"
        onChange={(e) => setTexto(e.target.value)} disabled={c.D.preview} />
      <small>Respuesta abierta · Se guarda sin calificación automática. La revisión docente se realiza por separado.</small>
      {inicial?.comentarioDocente && <div className="focus"><b>COMENTARIO DE TU DOCENTE</b><p>{inicial.comentarioDocente}</p></div>}
      <button type="submit" disabled={guardando || c.D.preview || !texto.trim()}>{guardando ? 'Guardando…' : 'Guardar respuesta'}</button>
    </form>
  )
}

// ── Visor de páginas (URL firmada + lectura tras 5 s) ─────────────────
function Visor({ ctx: c, step }: { ctx: Ctx; step: number | null }) {
  const subset = useMemo(() => (step ? c.D.paginas.filter((p) => p.stepNumber === step) : c.D.paginas), [c.D.paginas, step])
  const [pageNumber, setPageNumber] = useState(subset[0]?.page || 1)
  const [num, setNum] = useState(String(subset[0]?.page || 1))
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [zoom, setZoom] = useState(false)
  const [, setTick] = useState(0)
  const reintento = useRef<Set<string>>(new Set())
  const timer = useRef<number | undefined>(undefined)
  const p = c.D.paginas[pageNumber - 1]

  const pedir = useCallback(async (pg: Pagina, forzar = false) => {
    try {
      const { url } = await api<{ url: string }>(`${c.API}/pagina?id=${encodeURIComponent(pg.id)}`)
      setUrls((u) => (forzar || !u[pg.id] ? { ...u, [pg.id]: url } : u))
    } catch (e: any) { c.toast(e.message) }
  }, [c])

  useEffect(() => {
    setNum(String(pageNumber))
    if (p && !urls[p.id]) pedir(p)
    const i = subset.findIndex((x) => x.page === pageNumber)
    const sig = subset[i + 1]
    if (sig && !urls[sig.id]) pedir(sig)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber])

  const programarLectura = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!p || document.hidden || c.D.preview || c.leidasRef.current.has(p.id)) return
    timer.current = window.setTimeout(() => {
      if (document.hidden) return
      c.leidasRef.current.add(p.id)
      post(`${c.API}/vista`, { pageId: p.id }).then(() => setTick((t) => t + 1)).catch((e) => { c.leidasRef.current.delete(p.id); c.toast(e.message) })
    }, 5000)
  }, [p, c])

  useEffect(() => {
    const onVis = () => { window.clearTimeout(timer.current); if (!document.hidden) programarLectura() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearTimeout(timer.current) }
  }, [programarLectura])

  const cambiar = (delta: number) => {
    const i = subset.findIndex((x) => x.page === pageNumber)
    setPageNumber(subset[Math.max(0, Math.min(subset.length - 1, i + delta))].page)
  }
  const irA = () => {
    const n = Number(num)
    if (!Number.isInteger(n) || n < 1 || n > c.D.paginas.length) { c.toast('Escribe un número de página válido.'); return }
    if (step && !subset.some((x) => x.page === n)) { nav('book'); return }
    setPageNumber(n)
  }
  if (!p) return <p className="empty">No hay páginas para mostrar.</p>
  return (
    <>
      <div className="viewerControls">
        <button type="button" className="quiet" onClick={() => cambiar(-1)} aria-label="Página anterior">←</button>
        <label htmlFor="b2-pageNum" style={{ margin: 0 }}>Página</label>
        <input id="b2-pageNum" type="number" min={1} max={c.D.paginas.length} value={num} onChange={(e) => setNum(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') irA() }} />
        <span>de {c.D.paginas.length}</span>
        <button type="button" className="quiet" onClick={irA}>Ir</button>
        <button type="button" className="quiet" onClick={() => cambiar(1)} aria-label="Página siguiente">→</button>
        <button type="button" className="quiet" onClick={() => setZoom((z) => !z)}>Ampliar / ajustar</button>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
        {p.title} · {c.D.preview ? 'Vista previa' : c.leidasRef.current.has(p.id) ? '✓ Leída' : 'Se registra tras 5 segundos visibles'}
      </p>
      <div className={`viewer ${zoom ? 'zoom' : ''}`}>
        {urls[p.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={urls[p.id]} alt={`${c.D.level} — página ${p.page}: ${p.title}`} draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoad={() => { reintento.current.delete(p.id); programarLectura() }}
            onError={() => {
              if (!reintento.current.has(p.id)) { reintento.current.add(p.id); pedir(p, true) } else c.toast('No se pudo cargar esta página. Vuelve a intentarlo.')
            }} />
        ) : <p className="loading">Cargando página…</p>}
      </div>
    </>
  )
}

// ── Mi progreso ───────────────────────────────────────────────────────
function ProgressView({ ctx: c }: { ctx: Ctx }) {
  const hist = c.avance?.historial || []
  const descargar = () => {
    const blob = new Blob([JSON.stringify({ level: c.D.level, alumno: c.D.alumno.nombre, exportedAt: new Date().toISOString(), intentos: hist }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `LGS-${c.D.level}-mi-registro.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <>
      <p className="eyebrow">YOUR PROGRESS</p>
      <h1>Cada intento te acerca.</h1>
      <p className="muted">Tus datos se guardan con tu cuenta de Let’s Go Speak. No modifican tu nivel ni tu historial académico.</p>
      <div className="stats">
        <div><strong>{passed(c)} / {total(c)}</strong><span>Checkpoints aprobados</span></div>
        <div><strong>{readCount(c)} / {c.D.paginas.length}</strong><span>Páginas leídas</span></div>
        <div><strong>{c.avance?.respuestasGuardadas ?? 0}</strong><span>Respuestas abiertas guardadas</span></div>
      </div>
      <div className="bar"><i style={{ width: `${(passed(c) / Math.max(1, total(c))) * 100}%` }} /></div>
      {c.avance?.completado && (
        <div className="banner"><div><h3>¡Libro completado!</h3><p>Aprobaste todos los checkpoints de {c.D.level}.</p></div></div>
      )}
      <div className="actions"><button type="button" onClick={descargar} disabled={!hist.length}>Descargar mi registro</button></div>
      <div className="panel">
        <h2>Historial de intentos</h2>
        {hist.length ? (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Step</th><th>Fecha</th><th>Resultado</th><th>Estado</th></tr></thead>
              <tbody>
                {hist.map((h, k) => (
                  <tr key={k}>
                    <td>{h.step ?? '—'}{h.plus ? ' · Plus' : ''}</td>
                    <td>{new Date(h.creadoEn).toLocaleString()}</td>
                    <td>{h.correctas}/{h.total} · {Math.round((100 * h.correctas) / h.total)}%</td>
                    <td className={h.aprobado ? 'passed' : ''}>{h.aprobado ? 'Aprobado' : 'Sigue practicando'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">{c.D.preview ? 'Vista previa: aquí aparecen los intentos del alumno.' : 'Tu primer checkpoint te espera.'}</p>}
      </div>
    </>
  )
}

// ── Recursos ──────────────────────────────────────────────────────────
function ResourcesView({ ctx: c }: { ctx: Ctx }) {
  const abrirPdf = async () => {
    const w = window.open('', '_blank')
    try {
      const { url } = await api<{ url: string }>(`${c.API}/pdf`)
      if (w) w.location.href = url
    } catch (e: any) {
      w?.close()
      c.toast(e.message)
    }
  }
  const descargarPdf = async () => {
    try {
      const { url } = await api<{ url: string }>(`${c.API}/pdf?download=1`)
      window.location.href = url
    } catch (e: any) { c.toast(e.message) }
  }
  return (
    <>
      <p className="eyebrow">KEEP LEARNING</p>
      <h1>Tu libro, a mano.</h1>
      <div className="grid">
        <div className="card">
          <h3>PDF revisado</h3>
          <p>Lee o descarga la edición completa de {c.D.level}, con {c.D.paginas.length} páginas.</p>
          <div className="actions" style={{ margin: 0 }}>
            <button type="button" onClick={abrirPdf}>Abrir PDF ↗</button>
            <button type="button" className="secondary" onClick={descargarPdf}>Descargar</button>
          </div>
        </div>
        <div className="card">
          <h3>Libro página a página</h3>
          <p>Consulta todas las lecciones y ejercicios en el visor. El marcador de lectura se guarda con tu cuenta.</p>
          <a className="button" href="#book">Abrir visor →</a>
        </div>
        <div className="card">
          <h3>Cómo avanzas</h3>
          <p>75% para aprobar, intentos ilimitados y mejor nota conservada. Las lecturas y respuestas abiertas se registran por separado.</p>
          <a className="button" href="#progress">Ver registro →</a>
        </div>
      </div>
      <div className="banner">
        <div><h3>Tu libro, dentro de Let’s Go Speak.</h3><p>Tu avance, tus intentos y tus respuestas quedan en tu cuenta: puedes continuar desde cualquier dispositivo.</p></div>
      </div>
    </>
  )
}
