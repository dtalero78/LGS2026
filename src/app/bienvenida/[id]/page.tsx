'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

/**
 * Página PÚBLICA de bienvenida post-firma (`/bienvenida/[id]`).
 *
 * Destino del cliente al terminar de firmar el consentimiento en `/contrato/[id]`.
 * Agradece, deja constancia de la firma y explica el proceso de aprobación.
 * El diseño replica la identidad de letsgospeak.cl (paleta y tipografías del sitio).
 *
 * Gateada por el flag `bienvenida_pagina_activa` (Mantenimiento › Contratos):
 * el redirect solo apunta acá cuando está encendido.
 */

const WHATSAPP = '56942679066' // Canal B — ver whatsapp-config.service


function BienvenidaContent() {
  const params = useParams()
  const titularId = params.id as string
  const token = useSearchParams().get('t') || ''

  const [nombre, setNombre] = useState('')
  const [contrato, setContrato] = useState('')
  const [documento, setDocumento] = useState('')
  const [fecha, setFecha] = useState('')
  const [hash, setHash] = useState('')
  const [tipoAprobacion, setTipoAprobacion] = useState('')
  const [loading, setLoading] = useState(true)
  const [denegado, setDenegado] = useState(false)
  // Reapertura por documento cuando el enlace ya venció.
  const [tokenActivo, setTokenActivo] = useState('')
  const [docInput, setDocInput] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [errorDoc, setErrorDoc] = useState('')

  useEffect(() => { setTokenActivo(token) }, [token])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        // El endpoint exige el token: sin él (o vencido) responde 403 y no
        // devuelve ningún dato del titular.
        const res = await fetch(`/api/public/bienvenida/${titularId}?t=${encodeURIComponent(tokenActivo)}`, { cache: 'no-store' })
        const d = await res.json()
        if (cancelled) return
        if (!res.ok) { setDenegado(true); return }
        setDenegado(false)
        setNombre(d.nombre || '')
        setContrato(d.contrato || '')
        setDocumento(d.documento || '')
        setTipoAprobacion(d.tipoAprobacion || '')
        setHash(d.hashMasked || '')
        if (d.fechaFirma) {
          setFecha(new Date(d.fechaFirma).toLocaleString('es', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }))
        }
      } catch {
        if (!cancelled) setDenegado(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (!tokenActivo) { setDenegado(true); setLoading(false); return }
    setLoading(true)
    load()
    return () => { cancelled = true }
  }, [titularId, tokenActivo])

  // Enlace vencido: en vez de expulsar al cliente, le pedimos su documento
  // para reabrir la constancia por otros 60 minutos.
  const verificarDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docInput.trim() || verificando) return
    setVerificando(true)
    setErrorDoc('')
    try {
      const res = await fetch(`/api/public/bienvenida/${titularId}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: docInput }),
      })
      const d = await res.json()
      if (!res.ok || !d.token) {
        setErrorDoc(d?.error || 'El número de documento no coincide.')
        return
      }
      setTokenActivo(d.token) // dispara la recarga de datos
    } catch {
      setErrorDoc('No se pudo verificar. Intenta de nuevo.')
    } finally {
      setVerificando(false)
    }
  }

  if (denegado) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Epilogue:wght@500;600;700;800&family=Roboto:wght@400;500;700&display=swap" />
        <div className="bv-root bv-verify-root">
          <form className="bv-verify" onSubmit={verificarDocumento}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bv-verify-logo" src="/logo-lgs-blanco.png" alt="Let's Go Speak" />
            <h2>Confirma tu identidad</h2>
            <p className="bv-verify-txt">
              Por seguridad, tu constancia de firma se abre solo por un tiempo limitado.
              Ingresa tu número de documento para volver a verla.
            </p>
            <label className="bv-verify-label" htmlFor="bv-doc">Número de documento</label>
            <input
              id="bv-doc"
              className="bv-verify-input"
              value={docInput}
              onChange={(e) => { setDocInput(e.target.value); setErrorDoc('') }}
              placeholder="Ej: 18201897K"
              autoComplete="off"
              inputMode="text"
              disabled={verificando}
            />
            {errorDoc && <p className="bv-verify-err">{errorDoc}</p>}
            <button className="bv-verify-btn" type="submit" disabled={verificando || !docInput.trim()}>
              {verificando ? 'Verificando…' : 'Ver mi constancia'}
            </button>
            <a className="bv-verify-alt" href="https://letsgospeak.cl/">Ir a letsgospeak.cl</a>
          </form>
        </div>
      </>
    )
  }
  const saludo = nombre ? `Gracias por confiar en nosotros, ` : 'Gracias por confiar en nosotros'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Epilogue:wght@500;600;700;800&family=Roboto:wght@400;500;700&display=swap" />

      <div className="bv-root">
        <header className="bv-hero">
          <div className="bv-hero-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bv-logo" src="/logo-lgs-blanco.png" alt="Let's Go Speak" />
            <div className="bv-sello">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Contrato firmado
            </div>
            <h1>{saludo}{nombre && <span className="bv-nom">{nombre}</span>}</h1>
            <p className="bv-bajada">
              Tu contrato quedó firmado y registrado. Desde ahora eres parte de Let&apos;s Go Speak,
              el programa líder en enseñanza de inglés. Esto es lo que viene.
            </p>
          </div>
        </header>

        <div className="bv-wrap">
          <section className="bv-acta" aria-label="Constancia de firma">
            <div className="bv-acta-cab">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Consentimiento declarativo verificado
            </div>
            <dl className="bv-acta-datos">
              {contrato && <div className="bv-dato"><dt>Contrato</dt><dd>{contrato}</dd></div>}
              {fecha && <div className="bv-dato"><dt>Fecha y hora</dt><dd>{fecha}</dd></div>}
              {documento && <div className="bv-dato"><dt>Documento</dt><dd>{documento}</dd></div>}
              <div className="bv-dato"><dt>Verificación</dt><dd>{tipoAprobacion === 'AUTOMATICA' ? 'Aprobación directa' : 'WhatsApp · OTP'}</dd></div>
              {hash && (
                <div className="bv-dato" style={{ gridColumn: '1/-1' }}>
                  <dt>Sello de integridad (SHA-256)</dt>
                  <dd className="bv-hash">{hash} <span className="bv-nota">(fragmento)</span></dd>
                </div>
              )}
              {loading && <div className="bv-dato"><dt>&nbsp;</dt><dd style={{ color: 'var(--bv-tenue)' }}>Cargando…</dd></div>}
            </dl>
          </section>

          <section>
            <p className="bv-rotulo">Proceso de aprobación</p>
            <h2>Qué sigue ahora</h2>
            <p className="bv-intro">
              Tu contrato entra al proceso de aprobación. Te acompañamos paso a paso hasta tu primera
              clase — no tienes que hacer nada por ahora.
            </p>

            <ol className="bv-pasos">
              <li className="bv-paso bv-hecho">
                <span className="bv-num" aria-hidden="true">1</span>
                <div>
                  <h3>Firmaste tu contrato</h3>
                  <p>Tu consentimiento quedó registrado con sello de integridad y validez legal.</p>
                  <span className="bv-marca bv-ok">Completado</span>
                </div>
              </li>
              <li className="bv-paso bv-ahora">
                <span className="bv-num" aria-hidden="true">2</span>
                <div>
                  <h3>Revisión y aprobación</h3>
                  <p>Nuestro equipo verifica tu contrato y la información de tus beneficiarios. Normalmente toma 48 horas hábiles.</p>
                  <span className="bv-marca bv-now">En curso</span>
                </div>
              </li>
              <li className="bv-paso">
                <span className="bv-num" aria-hidden="true">3</span>
                <div>
                  <h3>Recibes tu enlace de activación</h3>
                  <p>A los beneficiarios les llegará un WhatsApp al número que registraron, para realizar la creación del perfil.</p>
                </div>
              </li>
              <li className="bv-paso">
                <span className="bv-num" aria-hidden="true">4</span>
                <div>
                  <h3>Agendas tu Welcome Session</h3>
                  <p>Tu primera sesión de bienvenida: conoces la plataforma, a tu advisor y definimos tu nivel de inicio. La podrás agendar al crear tu perfil.</p>
                </div>
              </li>
              <li className="bv-paso">
                <span className="bv-num" aria-hidden="true">5</span>
                <div>
                  <h3>Comienzas a hablar inglés</h3>
                  <p>Reserva tus sesiones o clubes, de acuerdo a la disponibilidad.</p>
                </div>
              </li>
            </ol>
          </section>

          <section>
            <p className="bv-rotulo">Tu programa</p>
            <h2>Lo que te espera</h2>
            <dl className="bv-programa">
              <div className="bv-fila"><dt>Sesiones</dt><dd>Sesiones en vivo con advisor, en grupos reducidos y horarios que tú eliges.</dd></div>
              <div className="bv-fila"><dt>Clubes</dt><dd>Conversación, pronunciación, gramática y listening para practicar sin presión.</dd></div>
              <div className="bv-fila"><dt>Niveles</dt><dd>Camino progresivo desde Beginner hasta Functional, avanzando paso a paso.</dd></div>
              <div className="bv-fila"><dt>Material</dt><dd>Contenido descargable e interactivo, disponible siempre en tu panel.</dd></div>
            </dl>
          </section>

          <section className="bv-cierre">
            <h2>Bienvenido a la familia LGS</h2>
            <p>
              Gracias por elegirnos para acompañarte en este camino. Si tienes cualquier duda mientras
              avanza tu aprobación, escríbenos: estamos para ayudarte.
            </p>
            <div className="bv-contacto">
              <a className="bv-btn bv-btn-a" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.94 1.35-.5.05-.99.24-3.35-.7-2.82-1.11-4.6-3.99-4.74-4.18-.14-.19-1.13-1.5-1.13-2.87s.72-2.03.97-2.31c.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.24.57.8 1.98.87 2.12.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.62-.14.25.09 1.6.76 1.87.89.28.14.46.21.53.32.07.12.07.66-.17 1.34z" /></svg>
                Escríbenos por WhatsApp
              </a>
            </div>
          </section>

          <footer className="bv-footer">
            <span>Let&apos;s Go Speak · Aprende inglés hoy</span>
            <span>Este documento es tu constancia de firma. Consérvalo.</span>
          </footer>
        </div>
      </div>
    </>
  )
}

/**
 * useSearchParams() exige un boundary de Suspense en el App Router:
 * sin esto el build de producción falla al prerenderizar la ruta.
 */
export default function BienvenidaPage() {
  return (
    <Suspense fallback={null}>
      <BienvenidaContent />
    </Suspense>
  )
}

const CSS = `
.bv-root{
  --bv-azul-profundo:#312782; --bv-azul:#0170B9; --bv-cyan:#1cbaeb;
  --bv-tinta:#26262e; --bv-tinta-suave:#585868; --bv-tenue:#8a8a9c;
  --bv-ground:#ffffff; --bv-panel:#f4f6fa; --bv-linea:#e2e6ef;
  --bv-exito:#1a8a5a; --bv-exito-fondo:#e9f7f0; --bv-exito-linea:#bfe6d4;
  --bv-sombra:0 1px 2px rgba(38,38,46,.06),0 8px 24px -12px rgba(49,39,130,.18);
  background:var(--bv-ground); color:var(--bv-tinta); min-height:100vh;
  font-family:Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-size:16px; line-height:1.6; -webkit-font-smoothing:antialiased;
}
.bv-root *{box-sizing:border-box}
.bv-root h1,.bv-root h2,.bv-root h3{font-family:Epilogue,Roboto,sans-serif;text-wrap:balance;margin:0}
.bv-wrap{max-width:760px;margin:0 auto;padding:0 24px}
.bv-hero{background:linear-gradient(148deg,var(--bv-azul-profundo) 0%,#1d4fa0 52%,var(--bv-azul) 100%);
  color:#fff;position:relative;overflow:hidden}
.bv-hero::after{content:"";position:absolute;right:-140px;top:-160px;width:460px;height:460px;
  background:radial-gradient(circle,rgba(28,186,235,.42),transparent 66%);pointer-events:none}
.bv-hero-in{position:relative;z-index:1;padding:44px 24px 52px;max-width:760px;margin:0 auto}
.bv-logo{height:52px;width:auto;display:block}
.bv-sello{display:inline-flex;align-items:center;gap:9px;margin-top:34px;
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);color:#fff;
  border-radius:999px;padding:7px 15px 7px 11px;font-size:12.5px;font-weight:700;
  letter-spacing:.07em;text-transform:uppercase}
.bv-sello svg{width:15px;height:15px;flex:none}
.bv-root h1{font-size:clamp(31px,5.4vw,45px);font-weight:800;line-height:1.13;margin:18px 0 0;letter-spacing:-.02em}
.bv-nom{color:var(--bv-cyan)}
.bv-bajada{margin:16px 0 0;font-size:17.5px;line-height:1.62;color:rgba(255,255,255,.93);max-width:60ch}
.bv-acta{background:var(--bv-panel);border:1px solid var(--bv-linea);border-radius:12px;
  box-shadow:var(--bv-sombra);margin:-26px auto 0;position:relative;z-index:2;max-width:712px}
.bv-acta-cab{display:flex;align-items:center;gap:9px;padding:15px 22px;border-bottom:1px solid var(--bv-linea);
  color:var(--bv-exito);font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
.bv-acta-cab svg{width:17px;height:17px;flex:none}
.bv-acta-datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:1px;background:var(--bv-linea);margin:0}
.bv-dato{background:var(--bv-panel);padding:15px 22px}
.bv-dato dt{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--bv-tenue);margin:0}
.bv-dato dd{margin:6px 0 0;font-size:15px;font-weight:500;color:var(--bv-tinta);font-variant-numeric:tabular-nums;word-break:break-word}
.bv-nota{font-family:Roboto,sans-serif;font-size:11px;color:var(--bv-tenue)}
.bv-hash{font-family:ui-monospace,"Cascadia Code",Consolas,monospace;font-size:12.5px;color:var(--bv-tinta-suave)}
.bv-root section{padding:52px 0 0}
.bv-rotulo{font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--bv-azul);margin:0 0 9px}
.bv-root h2{font-size:26px;font-weight:700;letter-spacing:-.015em}
.bv-intro{margin:11px 0 0;color:var(--bv-tinta-suave);max-width:62ch;font-size:16.5px}
.bv-pasos{list-style:none;margin:30px 0 0;padding:0}
.bv-paso{display:grid;grid-template-columns:38px 1fr;gap:18px;position:relative;padding-bottom:26px}
.bv-paso:last-child{padding-bottom:0}
.bv-paso::before{content:"";position:absolute;left:18.5px;top:38px;bottom:-4px;width:1.5px;background:var(--bv-linea)}
.bv-paso:last-child::before{display:none}
.bv-num{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:Epilogue,sans-serif;font-weight:700;font-size:15px;background:var(--bv-panel);
  border:1.5px solid var(--bv-linea);color:var(--bv-tinta-suave);position:relative;z-index:1;font-variant-numeric:tabular-nums}
.bv-hecho .bv-num{background:var(--bv-exito-fondo);border-color:var(--bv-exito-linea);color:var(--bv-exito)}
.bv-ahora .bv-num{background:var(--bv-azul);border-color:var(--bv-azul);color:#fff;box-shadow:0 0 0 4px rgba(1,112,185,.16)}
.bv-paso h3{font-size:17px;font-weight:700;margin:8px 0 0;letter-spacing:-.01em}
.bv-paso p{margin:5px 0 0;color:var(--bv-tinta-suave);font-size:15.5px;max-width:56ch}
.bv-marca{display:inline-block;margin:9px 0 0;font-size:11px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;padding:3px 9px;border-radius:4px}
.bv-ok{background:var(--bv-exito-fondo);color:var(--bv-exito);border:1px solid var(--bv-exito-linea)}
.bv-now{background:rgba(1,112,185,.12);color:var(--bv-azul);border:1px solid rgba(1,112,185,.28)}
.bv-programa{margin:28px 0 0;border-top:1px solid var(--bv-linea)}
.bv-fila{display:grid;grid-template-columns:118px 1fr;gap:20px;padding:15px 0;border-bottom:1px solid var(--bv-linea);align-items:baseline}
.bv-fila dt{font-family:Epilogue,sans-serif;font-weight:700;font-size:15px;color:var(--bv-azul)}
.bv-fila dd{margin:0;color:var(--bv-tinta-suave);font-size:15.5px}
.bv-cierre{margin:52px 0 0;padding:30px 26px;border-radius:12px;
  background:linear-gradient(140deg,var(--bv-azul-profundo),var(--bv-azul));color:#fff}
.bv-cierre h2{font-size:22px;color:#fff}
.bv-cierre p{margin:11px 0 0;color:rgba(255,255,255,.93);max-width:58ch;font-size:16px}
.bv-contacto{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 0}
.bv-btn{display:inline-flex;align-items:center;gap:8px;border-radius:8px;padding:11px 18px;
  font-weight:700;font-size:15px;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.bv-btn svg{width:17px;height:17px;flex:none}
.bv-btn-a{background:#fff;color:var(--bv-azul-profundo)}
.bv-btn:hover{transform:translateY(-1px);box-shadow:0 6px 18px -6px rgba(0,0,0,.42)}
.bv-btn:focus-visible{outline:3px solid var(--bv-cyan);outline-offset:2px}
.bv-footer{margin:44px 0 0;border-top:1px solid var(--bv-linea);padding:22px 0 44px;
  color:var(--bv-tenue);font-size:13.5px;display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between}
.bv-verify-root{display:grid;place-items:center;min-height:100vh;padding:32px 20px;
  background:linear-gradient(148deg,var(--bv-azul-profundo) 0%,#1d4fa0 52%,var(--bv-azul) 100%)}
.bv-verify{width:100%;max-width:420px;background:var(--bv-ground);border-radius:14px;
  box-shadow:0 18px 50px -18px rgba(0,0,0,.5);padding:30px 26px;display:flex;flex-direction:column}
.bv-verify-logo{height:40px;width:auto;align-self:center;margin-bottom:20px;
  filter:brightness(0) saturate(100%) invert(13%) sepia(64%) saturate(3200%) hue-rotate(232deg)}
.bv-verify h2{font-size:21px;font-weight:700;text-align:center}
.bv-verify-txt{margin:10px 0 0;color:var(--bv-tinta-suave);font-size:15px;text-align:center;line-height:1.55}
.bv-verify-label{margin:22px 0 6px;font-size:11px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:var(--bv-tenue)}
.bv-verify-input{border:1.5px solid var(--bv-linea);border-radius:8px;padding:11px 13px;font-size:16px;
  font-family:inherit;color:var(--bv-tinta);background:var(--bv-ground);letter-spacing:.02em}
.bv-verify-input:focus{outline:none;border-color:var(--bv-azul);box-shadow:0 0 0 3px rgba(1,112,185,.15)}
.bv-verify-input:disabled{opacity:.6}
.bv-verify-err{margin:9px 0 0;color:#c02626;font-size:14px}
.bv-verify-btn{margin:18px 0 0;background:var(--bv-azul);color:#fff;border:none;border-radius:8px;
  padding:12px 18px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;transition:opacity .15s}
.bv-verify-btn:disabled{opacity:.55;cursor:not-allowed}
.bv-verify-btn:hover:not(:disabled){opacity:.92}
.bv-verify-btn:focus-visible{outline:3px solid var(--bv-cyan);outline-offset:2px}
.bv-verify-alt{margin:14px 0 0;text-align:center;font-size:14px;color:var(--bv-tinta-suave);text-decoration:none}
.bv-verify-alt:hover{text-decoration:underline}
@media (prefers-reduced-motion:reduce){.bv-root *{transition:none!important}}
@media (max-width:560px){
  .bv-fila{grid-template-columns:1fr;gap:3px}
  .bv-hero-in{padding:34px 20px 46px}
  .bv-acta{margin-left:4px;margin-right:4px}
}
`
