'use client'

/**
 * /admin/actualizar-material/interactivo
 *
 * Panel admin para gestionar los libros del nuevo "Material Interactivo".
 *
 * Permite:
 *  - Ver el catálogo (7 libros: ESS, BEGINNER, PRACTICAL, FUNCTIONAL,
 *    IELTS, B2FIRST, TOEFL) y cuántas páginas tiene cada uno.
 *  - Ver/editar los rangos de páginas por nivel (BN1=1..100, etc.).
 *  - Subir audios MP3 por página (presigned PUT) y asociarlos a la BD.
 *  - Eliminar un audio asignado.
 *  - Activar/desactivar el feature flag global (con la consigna de hacer
 *    la prueba con direcciones internas antes de habilitarlo).
 *
 * NO incluye conversión PDF → imágenes — eso lo hace el script local
 * `scripts/upload-libro-interactivo.js`. Esta página muestra una nota con
 * el comando exacto para correrlo.
 *
 * Gateado por permiso ACADEMICO.MATERIAL.ACTUALIZAR.
 */

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AcademicoPermission } from '@/types/permissions'
import {
  BookOpenIcon,
  SpeakerWaveIcon,
  TrashIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'

/** Extrae un título sugerido de un nombre de archivo:
 *    "Diálogo - The Alphabet.mp3"  →  "Diálogo - The Alphabet"
 *    "page-008-dialogo.mp3"        →  "page 008 dialogo"
 *  Limpia extensión, guiones bajos y compacta espacios. */
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]{2,5}$/i, '')   // quita extensión
    .replace(/[_]+/g, ' ')              // _ → espacio
    .replace(/\s+/g, ' ')               // compacta
    .trim()
    .slice(0, 60)
}

/**
 * Fetch tolerante a respuestas no-JSON (servidor a veces devuelve HTML de
 * error 500 cuando la BD está saturada de slots). Reintenta con backoff
 * simple si detecta un error retriable (500 / connection slots / database).
 */
async function jsonFetchRetry(input: RequestInfo, init?: RequestInit, retries = 2): Promise<any> {
  let lastErr: any
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(input, init)
      const txt = await r.text()
      let j: any = null
      try { j = txt ? JSON.parse(txt) : null } catch {}
      if (!r.ok || j?.success === false) {
        const msg = j?.error || `HTTP ${r.status}${txt ? ': ' + txt.slice(0, 160) : ''}`
        throw new Error(msg)
      }
      return j
    } catch (e: any) {
      lastErr = e
      const msg = (e?.message || '').toLowerCase()
      const isRetriable = msg.includes('500') || msg.includes('database') ||
                          msg.includes('connection') || msg.includes('reserved') ||
                          msg.includes('failed to fetch')
      if (!isRetriable || i === retries) throw e
      await new Promise(r => setTimeout(r, 1500 * (i + 1)))
    }
  }
  throw lastErr
}

interface LibroAudio {
  pagina: number
  key: string
  titulo?: string | null
}

interface NivelBinding {
  code: string
  libroInteractivoCode: string | null
  libroPaginaInicio: number | null
  libroPaginaFin: number | null
}

interface LibroAdmin {
  codigo: string
  titulo: string
  totalPaginas: number
  audios: LibroAudio[]
  activo: boolean
  niveles: NivelBinding[]
}

export default function ActualizarMaterialInteractivoPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={AcademicoPermission.ACTUALIZAR_MATERIAL} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  )
}

function Content() {
  const [libros, setLibros] = useState<LibroAdmin[]>([])
  const [featureActive, setFeatureActive] = useState(false)
  const [clasicoActive, setClasicoActive] = useState(true)
  const [ejerciciosActive, setEjerciciosActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCodigo, setExpandedCodigo] = useState<string | null>(null)
  const [savingFlag, setSavingFlag] = useState(false)
  const [savingClasico, setSavingClasico] = useState(false)
  const [savingEjercicios, setSavingEjercicios] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const j = await jsonFetchRetry('/api/admin/libros-interactivos')
      setLibros(j.libros || [])
      setFeatureActive(Boolean(j.featureActive))
      setClasicoActive(j.clasicoActive !== false)
      setEjerciciosActive(Boolean(j.ejerciciosActive))
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleFlag = async () => {
    setSavingFlag(true)
    try {
      const j = await jsonFetchRetry('/api/admin/libros-interactivos/feature-flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !featureActive }),
      })
      setFeatureActive(j.active)
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setSavingFlag(false)
    }
  }

  const toggleClasico = async () => {
    setSavingClasico(true)
    try {
      const j = await jsonFetchRetry('/api/admin/libros-interactivos/feature-flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !clasicoActive, flag: 'clasico' }),
      })
      setClasicoActive(j.active)
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setSavingClasico(false)
    }
  }

  const toggleEjercicios = async () => {
    setSavingEjercicios(true)
    try {
      const j = await jsonFetchRetry('/api/admin/libros-interactivos/feature-flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !ejerciciosActive, flag: 'ejercicios' }),
      })
      setEjerciciosActive(j.active)
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setSavingEjercicios(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-2">
        <BookOpenIcon className="h-7 w-7 text-emerald-600" />
        <h1 className="text-2xl font-bold text-gray-900">Material Interactivo</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Gestión de los libros que verá el estudiante en el panel. Cada libro se sube una vez y los sub-niveles (BN1/BN2/BN3, P1/P2/P3, F1/F2/F3) son <strong>rangos</strong> de páginas del mismo libro padre.
      </p>

      {/* Feature flag */}
      <div className={`rounded-xl border-l-4 p-4 mb-6 ${featureActive ? 'bg-emerald-50 border-emerald-500' : 'bg-amber-50 border-amber-500'}`}>
        <div className="flex items-start gap-3">
          {featureActive
            ? <CheckCircleIcon className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            : <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />}
          <div className="flex-1">
            <p className={`text-sm font-semibold ${featureActive ? 'text-emerald-900' : 'text-amber-900'}`}>
              {featureActive
                ? 'Feature ACTIVO — los estudiantes ven el botón nuevo (LGS) además del clásico (Wix).'
                : 'Feature INACTIVO — los estudiantes solo ven el botón clásico (Wix).'}
            </p>
            <p className="text-xs text-gray-700 mt-0.5">
              Recomendación: primero <strong>prueba las direcciones</strong> internas del visor (`/panel-estudiante/material-interactivo/[nivel]`) con tu cuenta, después actívalo para todos.
            </p>
          </div>
          <button
            onClick={toggleFlag}
            disabled={savingFlag}
            className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 ${featureActive ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} disabled:opacity-50`}
          >
            {savingFlag ? '...' : featureActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Botón clásico (Wix) — apagable de forma independiente */}
      <div className={`rounded-xl border-l-4 p-4 mb-6 ${clasicoActive ? 'bg-indigo-50 border-indigo-500' : 'bg-gray-50 border-gray-400'}`}>
        <div className="flex items-start gap-3">
          <GlobeAltIcon className={`h-6 w-6 flex-shrink-0 ${clasicoActive ? 'text-indigo-600' : 'text-gray-500'}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${clasicoActive ? 'text-indigo-900' : 'text-gray-700'}`}>
              {clasicoActive
                ? 'Botón clásico (Wix) VISIBLE — los estudiantes lo ven junto al nuevo.'
                : 'Botón clásico (Wix) OCULTO — los estudiantes solo ven el material interactivo nuevo.'}
            </p>
            <p className="text-xs text-gray-700 mt-0.5">
              Apágalo cuando el material interactivo nuevo esté validado. Red de seguridad: en niveles sin libro nuevo cargado (ej. IELTS/B2FIRST/TOEFL) el botón clásico se sigue mostrando para no dejar al estudiante sin material.
            </p>
          </div>
          <button
            onClick={toggleClasico}
            disabled={savingClasico}
            className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 ${clasicoActive ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-50`}
          >
            {savingClasico ? '...' : clasicoActive ? 'Apagar clásico' : 'Encender clásico'}
          </button>
        </div>
      </div>

      {/* Fase 2 — ejercicios de práctica (auto-gradables, generados por IA) */}
      <div className={`rounded-xl border-l-4 p-4 mb-6 ${ejerciciosActive ? 'bg-amber-50 border-amber-500' : 'bg-gray-50 border-gray-400'}`}>
        <div className="flex items-start gap-3">
          <PencilSquareIcon className={`h-6 w-6 flex-shrink-0 ${ejerciciosActive ? 'text-amber-600' : 'text-gray-500'}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${ejerciciosActive ? 'text-amber-900' : 'text-gray-700'}`}>
              {ejerciciosActive
                ? 'Fase 2 ACTIVA — los estudiantes ven la tarjeta "Ejercicios de práctica" de su step.'
                : 'Fase 2 INACTIVA — los estudiantes no ven los ejercicios de práctica.'}
            </p>
            <p className="text-xs text-gray-700 mt-0.5">
              Ejercicios de práctica auto-gradables (opción múltiple, verdadero/falso, completar), generados por IA desde el contenido del step. Es <strong>solo práctica</strong>: no afecta el step ni el diagnóstico del estudiante.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleEjercicios}
            disabled={savingEjercicios}
            className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 ${ejerciciosActive ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'} disabled:opacity-50`}
          >
            {savingEjercicios ? '...' : ejerciciosActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Instructivo subida PDF */}
      <details className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6 text-sm">
        <summary className="cursor-pointer font-semibold text-gray-800">📘 ¿Cómo subir un PDF nuevo?</summary>
        <div className="mt-2 text-xs text-gray-700 space-y-1">
          <p>La conversión PDF → imágenes se hace con un script local. Desde la raíz del repo:</p>
          <pre className="bg-gray-900 text-emerald-300 rounded p-2 overflow-x-auto text-[11px]">
node scripts/upload-libro-interactivo.js \
  --codigo=BEGINNER \
  --pdf=./libro-beginner.pdf \
  --titulo="Beginner — Let's Go Speak 2024" \
  --apply
          </pre>
          <p className="text-gray-600">Requiere `pdftoppm` (poppler-utils) instalado en el sistema operativo del que ejecuta el script.</p>
        </div>
      </details>

      {/* Listado de libros */}
      {loading
        ? <div className="text-sm text-gray-500">Cargando catálogo…</div>
        : error
          ? <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          : (
            <div className="space-y-4">
              {libros.map(libro => (
                <LibroCard
                  key={libro.codigo}
                  libro={libro}
                  expanded={expandedCodigo === libro.codigo}
                  onToggle={() => setExpandedCodigo(prev => prev === libro.codigo ? null : libro.codigo)}
                  onReload={load}
                />
              ))}
            </div>
          )
      }
    </div>
  )
}

function LibroCard({ libro, expanded, onToggle, onReload }: {
  libro: LibroAdmin
  expanded: boolean
  onToggle: () => void
  onReload: () => void
}) {
  const sinPaginas = libro.totalPaginas === 0
  return (
    <div className={`bg-white rounded-xl border ${sinPaginas ? 'border-amber-200' : 'border-gray-200'} shadow-sm overflow-hidden`}>
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <BookOpenIcon className={`h-5 w-5 ${sinPaginas ? 'text-amber-500' : 'text-emerald-600'}`} />
            <h2 className="font-bold text-gray-800">{libro.codigo}</h2>
            <span className="text-xs text-gray-500">— {libro.titulo}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {sinPaginas
              ? <span className="text-amber-700 font-medium">Sin páginas cargadas — corre el script de subida</span>
              : <>{libro.totalPaginas} páginas · {libro.audios.length} audios · {libro.niveles.length} nivel(es) vinculados</>}
          </p>
        </div>
        <span className="text-xs text-gray-400">{expanded ? 'Cerrar' : 'Abrir'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-5 bg-gray-50">
          <SeccionRangos libro={libro} onReload={onReload} />
          <SeccionAudios libro={libro} onReload={onReload} />
        </div>
      )}
    </div>
  )
}

function SeccionRangos({ libro, onReload }: { libro: LibroAdmin; onReload: () => void }) {
  const [rows, setRows] = useState(libro.niveles)
  useEffect(() => { setRows(libro.niveles) }, [libro.niveles])

  const save = async (n: NivelBinding) => {
    try {
      await jsonFetchRetry(`/api/admin/libros-interactivos/${encodeURIComponent(libro.codigo)}/binding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nivelCode: n.code,
          libroInteractivoCode: libro.codigo,
          libroPaginaInicio: n.libroPaginaInicio,
          libroPaginaFin: n.libroPaginaFin,
        }),
      })
      onReload()
    } catch (e: any) { alert(e?.message || 'Error') }
  }

  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Niveles vinculados</h3>
        <p className="text-xs text-gray-500 italic">Ningún nivel apunta a este libro todavía.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Rangos por nivel</h3>
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Nivel</th>
              <th className="text-right px-3 py-2 w-28">Inicio</th>
              <th className="text-right px-3 py-2 w-28">Fin</th>
              <th className="text-right px-3 py-2 w-24">Páginas</th>
              <th className="text-right px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n, idx) => {
              const fin = n.libroPaginaFin ?? libro.totalPaginas
              const inicio = n.libroPaginaInicio ?? 1
              const cantidad = libro.totalPaginas > 0 ? Math.max(0, fin - inicio + 1) : 0
              return (
                <tr key={n.code} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{n.code}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      max={libro.totalPaginas || undefined}
                      value={n.libroPaginaInicio ?? 1}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10) || 1
                        const next = [...rows]
                        next[idx] = { ...n, libroPaginaInicio: v }
                        setRows(next)
                      }}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      max={libro.totalPaginas || undefined}
                      value={n.libroPaginaFin ?? ''}
                      placeholder="(final)"
                      onChange={e => {
                        const raw = e.target.value
                        const v = raw === '' ? null : (parseInt(raw, 10) || null)
                        const next = [...rows]
                        next[idx] = { ...n, libroPaginaFin: v }
                        setRows(next)
                      }}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600 tabular-nums">{cantidad}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => save(n)}
                      className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Mapea una página de LIBRO a su(s) nivel(es) + página local, usando los rangos
 * (bindings). Un libro lo comparten varios niveles como rangos de páginas; el
 * estudiante ve la "página local" del nivel, no la del libro. Normalmente una
 * página de libro cae en un solo nivel (devuelve 1 elemento).
 */
function bookToNivelLocal(
  bookPage: number,
  niveles: NivelBinding[],
  totalPaginas: number,
): Array<{ code: string; local: number }> {
  const out: Array<{ code: string; local: number }> = []
  for (const n of niveles) {
    const inicio = n.libroPaginaInicio ?? 1
    const fin = n.libroPaginaFin ?? totalPaginas
    if (bookPage >= inicio && bookPage <= fin) {
      out.push({ code: n.code, local: bookPage - inicio + 1 })
    }
  }
  return out
}

function SeccionAudios({ libro, onReload }: { libro: LibroAdmin; onReload: () => void }) {
  const [paginaNueva, setPaginaNueva] = useState<number | ''>('')
  // Helper "asignar por nivel": el admin elige nivel + página local y se calcula
  // la página de LIBRO (evita el error de confundir página local con la del libro).
  const [selNivel, setSelNivel] = useState('')
  const [selLocal, setSelLocal] = useState<number | ''>('')
  const [tituloNuevo, setTituloNuevo] = useState('')
  const [tituloTocado, setTituloTocado] = useState(false) // ¿el admin escribió en el input?
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // key del audio en edición
  const [editTitulo, setEditTitulo] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Al elegir archivo, pre-llenar título sugerido (solo si el admin no escribió ya).
  const handleFileChange = (f: File | null) => {
    setFile(f)
    if (f && !tituloTocado) {
      setTituloNuevo(titleFromFilename(f.name))
    }
  }

  // Sincroniza el helper nivel+local → página de libro.
  const syncNivelLocal = (code: string, local: number | '') => {
    setSelNivel(code)
    setSelLocal(local)
    if (code && typeof local === 'number' && local >= 1) {
      const n = libro.niveles.find(x => x.code === code)
      if (n) {
        const inicio = n.libroPaginaInicio ?? 1
        setPaginaNueva(inicio + local - 1)
      }
    }
  }

  // Equivalencia de la página de libro actual → nivel(es) + página local.
  const equivNueva = typeof paginaNueva === 'number'
    ? bookToNivelLocal(paginaNueva, libro.niveles, libro.totalPaginas)
    : []

  const startEdit = (key: string, tituloActual: string | null) => {
    setEditing(key)
    setEditTitulo(tituloActual || '')
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditTitulo('')
  }

  const saveEdit = async () => {
    if (!editing) return
    setSavingEdit(true)
    try {
      await jsonFetchRetry(`/api/admin/libros-interactivos/${encodeURIComponent(libro.codigo)}/audios`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editing, titulo: editTitulo.trim() || null }),
      })
      cancelEdit()
      onReload()
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setSavingEdit(false)
    }
  }

  const subir = async () => {
    if (typeof paginaNueva !== 'number' || paginaNueva < 1) {
      alert('Ingresa el número de página'); return
    }
    if (!file) { alert('Selecciona un archivo MP3'); return }
    setUploading(true)
    try {
      const presign = await jsonFetchRetry(`/api/admin/libros-interactivos/${encodeURIComponent(libro.codigo)}/audios/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagina: paginaNueva,
          titulo: tituloNuevo || undefined,
          contentType: file.type || 'audio/mpeg',
        }),
      })

      const put = await fetch(presign.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        body: file,
      })
      if (!put.ok) throw new Error(`Upload S3 falló (${put.status})`)

      await jsonFetchRetry(`/api/admin/libros-interactivos/${encodeURIComponent(libro.codigo)}/audios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagina: paginaNueva,
          key: presign.key,
          titulo: tituloNuevo || undefined,
        }),
      })

      setFile(null); setPaginaNueva(''); setTituloNuevo(''); setTituloTocado(false)
      onReload()
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setUploading(false)
    }
  }

  const eliminar = async (key: string, label: string) => {
    if (!confirm(`¿Eliminar el audio "${label}"?`)) return
    try {
      await jsonFetchRetry(`/api/admin/libros-interactivos/${encodeURIComponent(libro.codigo)}/audios?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      onReload()
    } catch (e: any) {
      alert(e?.message || 'Error')
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Audios</h3>
      <p className="text-xs text-gray-500 mb-2">Una página puede tener varios audios. Usa el título para distinguirlos (ej: "Diálogo", "Maria", "John"). Si no pones título, se usa "Audio N".</p>

      <div className="bg-white border border-gray-200 rounded p-3 mb-3">
        {/* Helper: asignar por nivel + página local → calcula la página de LIBRO.
            Evita confundir la página local (la que ve el estudiante) con la del libro. */}
        {libro.niveles.length > 0 && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <p className="text-[11px] text-gray-500 mb-1.5">
              💡 La página del <strong>libro</strong> no es la que ve el estudiante. Elige el <strong>nivel</strong> y la
              <strong> página local</strong> y se calcula la página de libro automáticamente.
            </p>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label htmlFor={`seln-${libro.codigo}`} className="block text-xs text-gray-600 mb-1">Nivel</label>
                <select
                  id={`seln-${libro.codigo}`}
                  value={selNivel}
                  onChange={e => syncNivelLocal(e.target.value, selLocal)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  {libro.niveles.map(n => <option key={n.code} value={n.code}>{n.code}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`sell-${libro.codigo}`} className="block text-xs text-gray-600 mb-1">Página local (la que ve el estudiante)</label>
                <input
                  id={`sell-${libro.codigo}`}
                  type="number"
                  min={1}
                  value={selLocal}
                  onChange={e => syncNivelLocal(selNivel, e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-sm tabular-nums"
                  placeholder="32"
                  title="Página local del nivel"
                />
              </div>
              {selNivel && typeof selLocal === 'number' && typeof paginaNueva === 'number' && (
                <span className="text-xs text-emerald-700 pb-1.5">→ página de libro <strong>{paginaNueva}</strong></span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label htmlFor={`pag-${libro.codigo}`} className="block text-xs text-gray-600 mb-1">Página (libro)</label>
            <input
              id={`pag-${libro.codigo}`}
              type="number"
              min={1}
              max={libro.totalPaginas || undefined}
              value={paginaNueva}
              onChange={e => { setPaginaNueva(e.target.value === '' ? '' : parseInt(e.target.value, 10) || ''); setSelNivel(''); setSelLocal('') }}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm tabular-nums"
              placeholder="12"
            />
            {typeof paginaNueva === 'number' && (
              <p className="text-[10px] mt-0.5 leading-tight">
                {equivNueva.length > 0
                  ? <span className="text-emerald-600">= {equivNueva.map(e => `${e.code} local ${e.local}`).join(', ')}</span>
                  : <span className="text-amber-600">⚠ fuera de los rangos por nivel</span>}
              </p>
            )}
          </div>
          <div className="w-44">
            <label htmlFor={`tit-${libro.codigo}`} className="block text-xs text-gray-600 mb-1">Título (opcional)</label>
            <input
              id={`tit-${libro.codigo}`}
              type="text"
              maxLength={60}
              value={tituloNuevo}
              onChange={e => { setTituloNuevo(e.target.value); setTituloTocado(true) }}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Diálogo (auto desde MP3)"
              title="Título del audio (opcional)"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label htmlFor={`audio-${libro.codigo}`} className="block text-xs text-gray-600 mb-1">Archivo MP3</label>
            <input
              id={`audio-${libro.codigo}`}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              onChange={e => handleFileChange(e.target.files?.[0] || null)}
              className="w-full text-xs"
            />
          </div>
          <button
            onClick={subir}
            disabled={uploading || !file || !paginaNueva}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {uploading ? 'Subiendo…' : 'Subir audio'}
          </button>
        </div>
      </div>

      {libro.audios.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Sin audios asignados.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 text-xs font-semibold text-indigo-700">
            Total: {libro.audios.length} audio{libro.audios.length === 1 ? '' : 's'}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-2 w-12">#</th>
                <th className="text-right px-3 py-2 w-20">Página (libro)</th>
                <th className="text-left px-3 py-2 w-28">Nivel · local</th>
                <th className="text-left px-3 py-2 w-56">Título</th>
                <th className="text-left px-3 py-2">Key</th>
                <th className="text-right px-3 py-2 w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...libro.audios]
                .sort((a, b) => {
                  if (a.pagina !== b.pagina) return a.pagina - b.pagina
                  return (a.titulo || '').localeCompare(b.titulo || '')
                })
                .map((a, idx) => {
                  const enEdicion = editing === a.key
                  return (
                    <tr key={a.key} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-right text-xs text-gray-400 tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{a.pagina}</td>
                      <td className="px-3 py-2 text-left text-xs">
                        {(() => {
                          const eq = bookToNivelLocal(a.pagina, libro.niveles, libro.totalPaginas)
                          return eq.length > 0
                            ? <span className="text-gray-700">{eq.map(e => `${e.code} · ${e.local}`).join(', ')}</span>
                            : <span className="text-amber-600">fuera de rango</span>
                        })()}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 truncate">
                        {enEdicion ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              maxLength={60}
                              value={editTitulo}
                              onChange={e => setEditTitulo(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit()
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              autoFocus
                              className="flex-1 border border-indigo-300 rounded px-2 py-0.5 text-xs"
                              placeholder="(sin título)"
                              title="Nuevo título"
                            />
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={savingEdit}
                              className="text-emerald-600 hover:text-emerald-800 text-xs px-1 disabled:opacity-40"
                              title="Guardar"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="text-gray-500 hover:text-gray-700 text-xs px-1 disabled:opacity-40"
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          a.titulo || <span className="italic text-gray-400">(sin título)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono truncate">{a.key}</td>
                      <td className="px-3 py-2 text-right">
                        {!enEdicion && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(a.key, a.titulo ?? null)}
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Editar título"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminar(a.key, a.titulo || `Audio página ${a.pagina}`)}
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar audio"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
