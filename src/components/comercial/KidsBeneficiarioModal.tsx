'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { plataformaToCountryCode, edadKidsEnFecha, cursoKidsParaEdad, errorEdadCursoKids, RANGO_EDAD_CURSO } from '@/lib/kids-mapping'
import KidsCursoTexto, { cursoColorCls } from '@/components/comercial/KidsCursoTexto'

/**
 * Datos "kids" adicionales de un beneficiario (curso + apoderado). Cuando la
 * integración con KIDS2026 está configurada, el curso se elige de un catálogo
 * real (Campaña → Tipo → Salón) y `classroomId` queda listo para el intake;
 * si no, campaña/tipo/horario se capturan como texto (placeholder).
 */
export interface KidsData {
  titularEsApoderado?: boolean
  campaign?: string        // nombre de la campaña
  campaignId?: string
  tipoCurso?: string       // JUNIOR | YOUNGSTER
  classroomId?: string     // salón elegido (uuid) — requerido para enviar a KIDS
  salonNombre?: string
  horario?: string         // resumen legible del horario
  apoderado?: string             // nombres del apoderado
  apoderadoApellidos?: string
  apoderadoDoc?: string
  apoderadoTelefono?: string
  apoderadoMail?: string
  parentesco?: string
}

export interface KidsBeneficiarioValue {
  primerNombre?: string
  segundoNombre?: string
  primerApellido?: string
  segundoApellido?: string
  numeroId?: string
  fechaNacimiento?: string
  email?: string
  celular?: string
  kidsData?: KidsData
}

// Tipos del catálogo (espejo de /api/postgres/kids-intake/availability).
interface Slot { tipo: string; diaSemana: number; horaLocal: string; duracionMin: number }
interface Salon { id: string; nombre: string; courseId: string; pais?: string | null; cupo: number; ocupados: number; cupoDisponible: number; lleno?: boolean; activo?: boolean; guia: string | null; horario: Slot[] }
interface Curso { tipo: string; salones: Salon[] }
interface Campania { id: string; nombre: string; inicio: string; fin: string; cursos: Curso[] }

const TIPOS_CURSO = ['JUNIOR', 'YOUNGSTER'] as const
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function horarioResumen(s: Salon): string {
  return (s.horario || []).map(h => `${DIAS[h.diaSemana] ?? h.diaSemana} ${h.horaLocal}`).join(' · ')
}

interface Props {
  open: boolean
  initial?: KidsBeneficiarioValue
  titularNombre?: string
  titularApellidos?: string
  titularDocumento?: string
  /** Celular del titular YA con indicativo (el padre lo arma con getPhonePrefix()). */
  titularCelular?: string
  titularEmail?: string
  /** Plataforma/país del contrato (Chile/Colombia/Ecuador/Perú) — filtra los salones por país. */
  plataforma?: string
  /**
   * true = muestra también los salones llenos (marcados LLENO, no seleccionables).
   * Lo usa la ficha del titular (pantalla de aprobación); Crear Contrato solo ve
   * salones con cupo.
   */
  mostrarLlenos?: boolean
  /** Texto del botón principal (la ficha usa "Continuar": el modal no guarda por sí solo). */
  textoGuardar?: string
  /** Título del modal (p. ej. "Modificar beneficiario Kids"). */
  titulo?: string
  /**
   * Curso ya registrado en KIDS (reservado o matriculado): se muestra de solo
   * lectura con este aviso y no se valida/cambia el salón desde LGS.
   */
  cursoFijo?: string | null
  onSave: (value: KidsBeneficiarioValue) => void
  onCancel: () => void
}

const salonLleno = (s: Salon) => s.lleno === true || s.ocupados >= s.cupo

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500'

export default function KidsBeneficiarioModal({
  open, initial, titularNombre, titularApellidos, titularDocumento, titularCelular, titularEmail, plataforma, mostrarLlenos = false, textoGuardar = 'Guardar beneficiario Kids', titulo = 'Beneficiario Kids', cursoFijo = null, onSave, onCancel,
}: Props) {
  const [form, setForm] = useState<KidsBeneficiarioValue>({})
  const [kids, setKids] = useState<KidsData>({})
  const [error, setError] = useState<string | null>(null)

  // Catálogo de KIDS (si la integración está configurada).
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [catalogConfigured, setCatalogConfigured] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  // Error real de KIDS (integración configurada pero la consulta falló). NO es "no configurado".
  const [catalogError, setCatalogError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({ ...(initial || {}) })
      setKids({ ...(initial?.kidsData || {}) })
      setError(null)
      setCatalogLoading(true)
      setCatalogError(null)
      fetch(`/api/postgres/kids-intake/availability${mostrarLlenos ? '?incluirLlenos=1' : ''}`)
        .then(r => r.json())
        .then(d => {
          if (d?.success === false) {
            // Error de LGS (sesión, servidor): no se puede saber si KIDS está conectado →
            // se trata como error, nunca como "captura provisional".
            setCatalogConfigured(true)
            setCatalogError(d.error || 'No se pudo consultar el catálogo de KIDS2026')
            setCampanias([])
            return
          }
          setCatalogConfigured(!!d.configured)
          setCatalogError(d.error || null)
          const lista: Campania[] = Array.isArray(d.campanias) ? d.campanias : []
          setCampanias(lista)
          // Al editar, la inscripción guarda el NOMBRE de la campaña (no su id): se resuelve.
          setKids(k => (k.campaignId || !k.campaign) ? k : { ...k, campaignId: lista.find(c => c.nombre === k.campaign)?.id || '' })
        })
        .catch(() => { setCatalogConfigured(true); setCatalogError('No se pudo consultar el catálogo de KIDS2026 (sin conexión)'); setCampanias([]) })
        .finally(() => setCatalogLoading(false))
    }
  }, [open, initial, mostrarLlenos])

  // Modal de edad: el curso elegido no corresponde a la edad del niño (o no cabe en
  // ningún curso Kids). Se abre al cambiar fecha de nacimiento / curso y al guardar.
  const [alertaEdad, setAlertaEdad] = useState<{ edad: number; actual: string | null; sugerido: string | null } | null>(null)
  const [alertaVista, setAlertaVista] = useState('')
  useEffect(() => { if (open) { setAlertaEdad(null); setAlertaVista('') } }, [open])
  useEffect(() => {
    if (!open || cursoFijo) return
    const edad = edadKidsEnFecha(form.fechaNacimiento)
    if (edad === null) return
    const sugerido = cursoKidsParaEdad(edad)
    const actual = kids.tipoCurso || null
    const clave = `${form.fechaNacimiento}|${actual || ''}`
    if ((!sugerido || (actual && actual !== sugerido)) && clave !== alertaVista) {
      setAlertaEdad({ edad, actual, sugerido })
      setAlertaVista(clave)
    }
  }, [open, cursoFijo, form.fechaNacimiento, kids.tipoCurso]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const setF = (k: keyof KidsBeneficiarioValue, v: any) => setForm(d => ({ ...d, [k]: v }))
  const setK = (k: keyof KidsData, v: any) => setKids(d => ({ ...d, [k]: v }))

  // ── Cascada del catálogo ──
  // Los salones de KIDS se agrupan por país de forma binaria: grupo 01 = "CL",
  // grupo 02/resto = "CO". El contrato de Chile ve solo salones "CL"; cualquier
  // otro país (Colombia/Ecuador/Perú) ve solo los "CO".
  const grupoPaisContrato = plataformaToCountryCode(plataforma) === 'CL' ? 'CL' : 'CO'
  // Fallback: si el salón no trae `pais` (KIDS aún sin desplegar el campo) se muestra,
  // para no dejar el selector vacío durante la transición.
  // Sin `mostrarLlenos` (Crear Contrato) los llenos se descartan también aquí, por si
  // KIDS llegara a mandarlos.
  const salonDelPais = (s: Salon) => s.activo !== false && (!s.pais || s.pais === grupoPaisContrato) && (mostrarLlenos || !salonLleno(s))
  // Solo se ofrecen campañas (y cursos) que tengan AL MENOS un salón con cupo del
  // país del contrato: una campaña en matrícula sin salones para este país no
  // sirve para inscribir y antes aparecía igual (selector de cursos vacío).
  const campaniasUtiles = campanias
    .map(c => ({ ...c, cursos: c.cursos.map(cu => ({ ...cu, salones: cu.salones.filter(salonDelPais) })).filter(cu => cu.salones.length > 0) }))
    .filter(c => c.cursos.length > 0)
  const campaniaSel = campaniasUtiles.find(c => c.id === kids.campaignId)
  const cursosDeCampania = campaniaSel?.cursos ?? []
  const cursoSel = cursosDeCampania.find(c => c.tipo === kids.tipoCurso)
  const salonesDeCurso = cursoSel?.salones ?? []

  // Edad del niño hoy → curso que le corresponde (misma regla que KIDS: Junior 6–9, Youngster 10–13).
  const edadNino = edadKidsEnFecha(form.fechaNacimiento)
  const cursoPorEdad = cursoKidsParaEdad(edadNino)

  const onSelectCampania = (id: string) => {
    const c = campaniasUtiles.find(x => x.id === id)
    // Preselecciona el curso que corresponde por edad, si la campaña lo tiene.
    const tipoAuto = cursoPorEdad && c?.cursos.some(cu => cu.tipo === cursoPorEdad) ? cursoPorEdad : ''
    setKids(d => ({ ...d, campaignId: id, campaign: c?.nombre || '', tipoCurso: tipoAuto, classroomId: '', salonNombre: '', horario: '' }))
  }
  const onSelectTipo = (t: string) => setKids(d => ({ ...d, tipoCurso: t, classroomId: '', salonNombre: '', horario: '' }))
  const onSelectSalon = (id: string) => {
    const s = salonesDeCurso.find(x => x.id === id)
    if (s && salonLleno(s)) return
    setKids(d => ({ ...d, classroomId: id, salonNombre: s?.nombre || '', horario: s ? horarioResumen(s) : '' }))
  }

  const toggleTitularApoderado = (checked: boolean) => {
    if (checked) {
      setKids(d => ({
        ...d, titularEsApoderado: true,
        apoderado: titularNombre || d.apoderado || '',
        apoderadoApellidos: titularApellidos || d.apoderadoApellidos || '',
        apoderadoDoc: titularDocumento || d.apoderadoDoc || '',
        apoderadoTelefono: titularCelular || d.apoderadoTelefono || '',
        apoderadoMail: titularEmail || d.apoderadoMail || '',
      }))
    } else {
      setKids(d => ({ ...d, titularEsApoderado: false }))
    }
  }
  const apoderadoLocked = kids.titularEsApoderado === true

  const guardar = () => {
    if (!form.primerNombre?.trim() || !form.primerApellido?.trim()) {
      setError('El primer nombre y el primer apellido son obligatorios'); return
    }
    if (!form.numeroId?.trim()) { setError('El número de identificación es obligatorio'); return }
    if (!form.email?.trim() || !emailRe.test(form.email.trim())) {
      setError('El correo no es válido (debe contener @ y dominio, sin espacios)'); return
    }
    // La fecha de nacimiento del niño es obligatoria para KIDS (valida la edad).
    if (!form.fechaNacimiento?.trim()) { setError('La fecha de nacimiento es obligatoria para el proceso Kids'); return }
    if (!cursoFijo) {
      // KIDS rechaza la reserva si la edad no corresponde al curso: se valida antes.
      const errEdad = errorEdadCursoKids(form.fechaNacimiento, kids.tipoCurso)
      const edadG = edadKidsEnFecha(form.fechaNacimiento)
      if (errEdad || (edadG !== null && !cursoKidsParaEdad(edadG))) {
        setError(errEdad || 'La edad del niño no corresponde a ningún curso Kids (6–13 años).')
        if (edadG !== null) setAlertaEdad({ edad: edadG, actual: kids.tipoCurso || null, sugerido: cursoKidsParaEdad(edadG) })
        return
      }
      // Si KIDS está conectado, hay que elegir un salón real (sin él la reserva no se envía).
      if (catalogConfigured && catalogError) { setError(`${catalogError} No se puede inscribir el kid hasta resolverlo.`); return }
      if (catalogConfigured && !kids.classroomId) { setError('Selecciona campaña, tipo de curso y salón'); return }
    }
    onSave({ ...form, kidsData: kids })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {titulo} <span className="ml-2 align-middle inline-block bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full">🧒 KIDS</span>
            </h2>
            <p className="text-sm text-gray-500">Datos del beneficiario, curso y apoderado</p>
          </div>
          <button type="button" onClick={onCancel} title="Cancelar" className="text-gray-400 hover:text-gray-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>}

          {/* Datos del beneficiario */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">Datos del beneficiario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Primer nombre" required><input value={form.primerNombre || ''} onChange={e => setF('primerNombre', e.target.value)} className={inputCls} /></Field>
              <Field label="Segundo nombre"><input value={form.segundoNombre || ''} onChange={e => setF('segundoNombre', e.target.value)} className={inputCls} /></Field>
              <Field label="Primer apellido" required><input value={form.primerApellido || ''} onChange={e => setF('primerApellido', e.target.value)} className={inputCls} /></Field>
              <Field label="Segundo apellido"><input value={form.segundoApellido || ''} onChange={e => setF('segundoApellido', e.target.value)} className={inputCls} /></Field>
              <Field label="N° identificación" required><input value={form.numeroId || ''} onChange={e => setF('numeroId', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={`${inputCls} font-mono`} /></Field>
              <Field label="Fecha de nacimiento" required><input type="date" value={form.fechaNacimiento || ''} onChange={e => setF('fechaNacimiento', e.target.value)} className={inputCls} /></Field>
              <Field label="Email" required><input value={form.email || ''} onChange={e => setF('email', e.target.value.replace(/\s/g, ''))} className={`${inputCls} font-mono`} placeholder="correo@dominio.com" /></Field>
              <Field label="Celular" required><input value={form.celular || ''} onChange={e => setF('celular', e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder="Solo dígitos" /></Field>
            </div>
          </div>

          {/* Curso */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-1"><span className="text-primary-600">＋</span> Curso <span className="normal-case font-normal text-gray-400">(adicional Kids)</span></h3>
            {cursoFijo ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p>
                  <KidsCursoTexto texto={kids.salonNombre || kids.tipoCurso || '—'} className="font-semibold" />
                  {kids.horario ? <span className="text-blue-800"> · {kids.horario}</span> : null}
                  {kids.campaign ? <span className="text-blue-800"> · {kids.campaign}</span> : null}
                </p>
                <p className="text-xs mt-1">{cursoFijo}</p>
              </div>
            ) : catalogLoading ? (
              <p className="text-xs text-gray-400 mb-3">Cargando catálogo…</p>
            ) : catalogConfigured && catalogError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <strong>No se pudo verificar la campaña en KIDS2026.</strong> {catalogError}
                <p className="text-xs mt-1">Sin el catálogo no se puede elegir salón y la inscripción no llegaría a KIDS. Intente de nuevo o avise a Tecnología.</p>
              </div>
            ) : catalogConfigured ? (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Catálogo de KIDS2026: campañas en matrícula{mostrarLlenos ? ' (todos los salones; los llenos aparecen en rojo y no se pueden elegir)' : ' con cupo'}. Contrato de{' '}
                  <strong className="text-gray-600">{plataforma || 'país sin definir'}</strong> → solo salones de{' '}
                  <strong className="text-gray-600">{grupoPaisContrato === 'CL' ? 'Chile' : 'Colombia / Ecuador / Perú'}</strong>.
                </p>
                {campaniasUtiles.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                    No hay campañas en matrícula con salones disponibles para {grupoPaisContrato === 'CL' ? 'Chile' : 'este país'}
                    {campanias.length > 0 ? ` (hay ${campanias.length} campaña(s) en matrícula, pero sin cupo para este país)` : ''}.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Campaña" required>
                    <select value={kids.campaignId || ''} onChange={e => onSelectCampania(e.target.value)} className={`${inputCls} bg-white`}>
                      <option value="">— Selecciona —</option>
                      {campaniasUtiles.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.inicio ? ` (${String(c.inicio).slice(0, 10)} → ${String(c.fin).slice(0, 10)})` : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Tipo de curso" required>
                    <select value={kids.tipoCurso || ''} onChange={e => onSelectTipo(e.target.value)} disabled={!campaniaSel} className={`${inputCls} bg-white disabled:bg-gray-50 font-bold ${cursoColorCls(kids.tipoCurso) || 'text-gray-900'}`}>
                      <option value="" className="font-normal text-gray-900">{campaniaSel ? '— Selecciona —' : '— Elige campaña —'}</option>
                      {cursosDeCampania.map(c => {
                        const noEdad = !!cursoPorEdad && c.tipo !== cursoPorEdad
                        return <option key={c.tipo} value={c.tipo} disabled={noEdad} className={`font-bold ${cursoColorCls(c.tipo)}`}>{c.tipo}{noEdad ? ' (no corresponde por edad)' : ''}</option>
                      })}
                    </select>
                    {edadNino !== null && (
                      <p className={`text-xs mt-1 ${cursoPorEdad ? 'text-gray-500' : 'text-red-600 font-semibold'}`}>
                        Edad hoy: {edadNino} años → {cursoPorEdad ? <strong className={cursoColorCls(cursoPorEdad)}>{cursoPorEdad}</strong> : 'no corresponde a ningún curso Kids (6–13 años)'}
                      </p>
                    )}
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Salón / horario" required>
                      {!cursoSel ? (
                        <div className={`${inputCls} bg-gray-50 text-gray-400`}>— Elige tipo de curso —</div>
                      ) : (
                        <div className="border border-gray-300 rounded-md divide-y divide-gray-100 max-h-56 overflow-y-auto">
                          {salonesDeCurso.map(s => {
                            const lleno = salonLleno(s)
                            const sel = kids.classroomId === s.id
                            return (
                              <button
                                key={s.id} type="button" disabled={lleno} onClick={() => onSelectSalon(s.id)}
                                title={lleno ? 'Salón lleno: no se puede inscribir' : undefined}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 ${
                                  lleno ? 'bg-red-50 cursor-not-allowed'
                                    : sel ? 'bg-primary-50 ring-1 ring-inset ring-primary-500' : 'hover:bg-gray-50'}`}
                              >
                                <span className={`h-4 w-4 flex-shrink-0 rounded-full border ${sel ? 'border-primary-600 border-[5px]' : 'border-gray-300'}`} />
                                <span className="flex-1 min-w-0">
                                  <KidsCursoTexto texto={s.nombre} className={lleno ? 'opacity-70' : ''} />
                                  <span className={lleno ? 'text-red-700' : 'text-gray-600'}>
                                    {' · '}{horarioResumen(s) || 'sin horario'}{s.guia ? ` · ${s.guia}` : ''}
                                  </span>
                                </span>
                                {lleno ? (
                                  <span className="flex-shrink-0 text-[11px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full">LLENO {s.ocupados}/{s.cupo}</span>
                                ) : (
                                  <span className="flex-shrink-0 text-xs text-gray-500">cupo {s.cupoDisponible}/{s.cupo}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </Field>
                    {cursoSel && salonesDeCurso.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No hay salones con cupo para este curso en {grupoPaisContrato === 'CL' ? 'Chile' : 'este país'}.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3">KIDS2026 aún no está conectado — captura provisional (se validará contra su catálogo al conectar).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Campaña"><input value={kids.campaign || ''} onChange={e => setK('campaign', e.target.value)} className={inputCls} /></Field>
                  <Field label="Tipo de curso">
                    <select value={kids.tipoCurso || ''} onChange={e => setK('tipoCurso', e.target.value)} className={`${inputCls} bg-white font-bold ${cursoColorCls(kids.tipoCurso) || 'text-gray-900'}`}>
                      <option value="" className="font-normal text-gray-900">— Selecciona —</option>
                      {TIPOS_CURSO.map(t => <option key={t} value={t} className={`font-bold ${cursoColorCls(t)}`}>{t}</option>)}
                    </select>
                  </Field>
                  <div className="sm:col-span-2"><Field label="Horario"><input value={kids.horario || ''} onChange={e => setK('horario', e.target.value)} className={inputCls} /></Field></div>
                </div>
              </>
            )}
          </div>

          {/* Apoderado */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3"><span className="text-primary-600">＋</span> Apoderado <span className="normal-case font-normal text-gray-400">(adicional Kids)</span></h3>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={kids.titularEsApoderado === true} onChange={e => toggleTitularApoderado(e.target.checked)} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
              <span className="text-sm text-gray-800">¿El titular será el apoderado?</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombres del apoderado"><input value={kids.apoderado || ''} disabled={apoderadoLocked} onChange={e => setK('apoderado', e.target.value)} className={`${inputCls} disabled:bg-gray-100`} /></Field>
              <Field label="Apellidos del apoderado"><input value={kids.apoderadoApellidos || ''} disabled={apoderadoLocked} onChange={e => setK('apoderadoApellidos', e.target.value)} className={`${inputCls} disabled:bg-gray-100`} /></Field>
              <Field label="N° documento"><input value={kids.apoderadoDoc || ''} disabled={apoderadoLocked} onChange={e => setK('apoderadoDoc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={`${inputCls} disabled:bg-gray-100 font-mono`} /></Field>
              {/* Parentesco = relación del apoderado con el niño: no es un dato del titular,
                  así que sigue editable aunque el titular sea el apoderado. */}
              <Field label="Parentesco"><input value={kids.parentesco || ''} onChange={e => setK('parentesco', e.target.value)} className={inputCls} placeholder="Madre, padre, tutor…" /></Field>
              <Field label="Teléfono"><input value={kids.apoderadoTelefono || ''} disabled={apoderadoLocked} onChange={e => setK('apoderadoTelefono', e.target.value.replace(/\D/g, ''))} className={`${inputCls} disabled:bg-gray-100`} placeholder="Solo dígitos" /></Field>
              <Field label="Correo"><input value={kids.apoderadoMail || ''} disabled={apoderadoLocked} onChange={e => setK('apoderadoMail', e.target.value.replace(/\s/g, ''))} className={`${inputCls} disabled:bg-gray-100 font-mono`} placeholder="correo@dominio.com" /></Field>
            </div>
            {apoderadoLocked && <p className="text-xs text-gray-400 mt-2">El apoderado tomará los datos del titular del contrato. Indique el parentesco con el niño.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={guardar} className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700">{textoGuardar}</button>
        </div>
      </div>

      {/* Modal de edad vs curso */}
      {alertaEdad && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-700">
              {alertaEdad.sugerido ? 'La edad no corresponde al curso' : 'No cumple la edad para Kids'}
            </h3>
            <p className="mt-3 text-sm text-gray-700">
              {`${form.primerNombre || 'El niño'} ${form.primerApellido || ''}`.trim()} tiene <strong>{alertaEdad.edad} años</strong> hoy.
            </p>
            {alertaEdad.sugerido ? (
              <p className="mt-2 text-sm text-gray-700">
                {alertaEdad.actual && RANGO_EDAD_CURSO[alertaEdad.actual]
                  ? <>El curso <strong className={cursoColorCls(alertaEdad.actual)}>{alertaEdad.actual}</strong> es para {RANGO_EDAD_CURSO[alertaEdad.actual].etiqueta.replace(/^[^(]+/, '').trim()}. </>
                  : null}
                Por su edad le corresponde <strong className={cursoColorCls(alertaEdad.sugerido)}>{alertaEdad.sugerido}</strong> ({RANGO_EDAD_CURSO[alertaEdad.sugerido].etiqueta.replace(/^[^(]+/, '').trim()}). KIDS rechaza la inscripción si no coincide.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-700">
                Los cursos Kids son para niños de <strong>6 a 13 años</strong> (Junior 6–9, Youngster 10–13). Revise la fecha de nacimiento; si es correcta, no puede inscribirse en Kids.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setAlertaEdad(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                {alertaEdad.sugerido ? 'Revisar fecha de nacimiento' : 'Entendido'}
              </button>
              {alertaEdad.sugerido && (
                <button type="button"
                  onClick={() => {
                    const s = alertaEdad.sugerido!
                    setKids(d => ({ ...d, tipoCurso: s, classroomId: '', salonNombre: '', horario: '' }))
                    setAlertaVista(`${form.fechaNacimiento}|${s}`)
                    setError(null)
                    setAlertaEdad(null)
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-primary-600 hover:bg-primary-700">
                  Cambiar a {alertaEdad.sugerido}
                </button>
              )}
            </div>
            {alertaEdad.sugerido && (
              <p className="mt-3 text-xs text-gray-400">Al cambiar el curso deberá elegir de nuevo el salón.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
    </div>
  )
}
