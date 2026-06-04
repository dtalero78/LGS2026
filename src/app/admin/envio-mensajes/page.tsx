'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions/PermissionGuard'
import { MantenimientoPermission } from '@/types/permissions'
import {
  ChatBubbleLeftRightIcon,
  UserIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { fillTemplate } from '@/lib/message-template-filler'
import { normalizeNumeroId } from '@/lib/numeroid-normalize'

interface Template {
  _id: string
  slug: string
  nombre: string
  descripcion: string | null
  contenido: string
  placeholders: string[]
  activo: boolean
}

interface LookupItem {
  numeroIdOriginal: string
  numeroId: string
  valido: boolean
  error?: string
  academicaId?: string
  peopleId?: string | null
  usuarioRolEmail?: string | null
  nombre?: string | null
  primerApellido?: string | null
  celular?: string | null
  nivel?: string | null
  step?: string | null
  plataforma?: string | null
  contrato?: string | null
  estadoInactivo?: boolean | null
}

interface SendResult {
  numeroId: string
  nombre: string
  celular: string
  ok: boolean
  mensajeEnviado?: string
  error?: string
}

const MAX_RECIPIENTS = 300

type Mode = 'individual' | 'masivo'

/** Parsea un CSV simple: encabezado en la primera línea + datos. Acepta `,` o `;`. */
function parseCsvNumeroIds(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  // Detecta separador
  const sep = lines[0].includes(';') ? ';' : ','
  const header = lines[0].split(sep).map(c => c.trim().toLowerCase())
  // Aliases aceptados como columna de ID
  const aliases = ['numeroid', 'documento', 'id', 'cedula', 'cédula', 'numero', 'número']
  let colIdx = header.findIndex(h => aliases.includes(h))
  // Si no hay encabezado claro y la primera fila parece un ID, asumir 1 sola columna sin encabezado
  if (colIdx === -1) {
    if (header.length === 1) {
      // Toda primera línea es un valor
      return lines.map(l => l.split(sep)[0].trim()).filter(Boolean)
    }
    return []
  }
  // Saltar el encabezado
  return lines.slice(1).map(l => (l.split(sep)[colIdx] || '').trim()).filter(Boolean)
}

export default function EnvioMensajesPage() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Individual
  const [individualInput, setIndividualInput] = useState('')

  // Masivo
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')

  // Lookup results
  const [lookupItems, setLookupItems] = useState<LookupItem[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [selectedNumeroIds, setSelectedNumeroIds] = useState<Set<string>>(new Set())
  const [showOnlyValid, setShowOnlyValid] = useState(true)

  // Edición celular inline
  const [editingCelularFor, setEditingCelularFor] = useState<LookupItem | null>(null)
  const [editingCelularValue, setEditingCelularValue] = useState('')
  const [savingCelular, setSavingCelular] = useState(false)

  // Send
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResult[] | null>(null)

  // Cargar plantillas activas al montar
  useEffect(() => {
    fetch('/api/admin/plantillas?includeInactive=false')
      .then(r => r.json())
      .then(j => {
        if (j.success) setTemplates(j.items || [])
        else throw new Error(j.error || 'Error cargando plantillas')
      })
      .catch(e => toast.error(e?.message || 'Error cargando plantillas'))
      .finally(() => setTemplatesLoading(false))
  }, [])

  const selectedTemplate = useMemo(
    () => templates.find(t => t._id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  )

  // Preview del mensaje (usa el primer destinatario válido seleccionado)
  const previewMessage = useMemo(() => {
    if (!selectedTemplate) return ''
    const sample = lookupItems.find(i => i.valido && selectedNumeroIds.has(i.numeroId))
      || lookupItems.find(i => i.valido)
      || lookupItems[0]
    if (!sample) return selectedTemplate.contenido
    return fillTemplate(selectedTemplate.contenido, {
      nombre: sample.nombre, primerApellido: sample.primerApellido,
      nivel: sample.nivel, step: sample.step,
      plataforma: sample.plataforma, contrato: sample.contrato,
      numeroId: sample.numeroId,
    })
  }, [selectedTemplate, lookupItems, selectedNumeroIds])

  // ─────────────────────── Lookup actions ───────────────────────

  const handleLookup = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('No hay numeroIds para buscar')
      return
    }
    if (ids.length > MAX_RECIPIENTS) {
      toast.error(`Máximo ${MAX_RECIPIENTS} numeroIds. Recibidos: ${ids.length}`)
      return
    }
    setLookupLoading(true); setResults(null)
    try {
      const r = await fetch('/api/admin/envio-mensajes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroIds: ids }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j?.error || `Error ${r.status}`)
      setLookupItems(j.items as LookupItem[])
      // Pre-seleccionar todos los válidos
      setSelectedNumeroIds(new Set((j.items as LookupItem[]).filter(i => i.valido).map(i => i.numeroId)))
    } catch (e: any) {
      toast.error(e?.message || 'Error en lookup')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleIndividualSearch = () => {
    const n = normalizeNumeroId(individualInput)
    if (!n) { toast.error('Ingresa un numeroId'); return }
    handleLookup([n])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = String(ev.target?.result || '')
      setCsvText(text)
    }
    reader.readAsText(f)
  }

  const handleMasivoProcess = () => {
    if (!csvText.trim()) {
      toast.error('Carga primero un archivo CSV')
      return
    }
    const ids = parseCsvNumeroIds(csvText)
    if (ids.length === 0) {
      toast.error('El CSV no contiene numeroIds reconocibles. Encabezado esperado: numeroId/documento/id/cedula')
      return
    }
    handleLookup(ids)
  }

  // ─────────────────────── Edición celular ───────────────────────

  const openEditCelular = (item: LookupItem) => {
    setEditingCelularFor(item)
    setEditingCelularValue((item.celular || '').replace(/\D/g, ''))
  }

  const saveCelular = async () => {
    if (!editingCelularFor) return
    setSavingCelular(true)
    try {
      const r = await fetch('/api/admin/envio-mensajes/update-celular', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroId: editingCelularFor.numeroId, celular: editingCelularValue }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j?.error || `Error ${r.status}`)
      toast.success(`Celular actualizado en ${(j.afectados.people + j.afectados.academica + j.afectados.usuariosRoles)} registro(s)`)
      // Actualizar item localmente y re-validar
      setLookupItems(prev => prev.map(it =>
        it.numeroId === editingCelularFor.numeroId
          ? { ...it, celular: j.celular, valido: true, error: undefined }
          : it,
      ))
      setSelectedNumeroIds(s => new Set(Array.from(s).concat([editingCelularFor.numeroId])))
      setEditingCelularFor(null)
    } catch (e: any) {
      toast.error(e?.message || 'Error al actualizar')
    } finally {
      setSavingCelular(false)
    }
  }

  // ─────────────────────── Envío ───────────────────────

  const handleSend = async () => {
    if (!selectedTemplate) { toast.error('Selecciona una plantilla'); return }
    const destinatarios = lookupItems
      .filter(i => i.valido && selectedNumeroIds.has(i.numeroId) && i.celular)
      .map(i => ({
        numeroId: i.numeroId,
        nombre: i.nombre || '',
        primerApellido: i.primerApellido || '',
        celular: i.celular!,
        nivel: i.nivel || null,
        step: i.step || null,
        plataforma: i.plataforma || null,
        contrato: i.contrato || null,
      }))
    if (destinatarios.length === 0) {
      toast.error('No hay destinatarios válidos seleccionados')
      return
    }
    if (destinatarios.length > MAX_RECIPIENTS) {
      toast.error(`Máximo ${MAX_RECIPIENTS} destinatarios por envío`)
      return
    }
    setSending(true); setResults(null)
    try {
      const r = await fetch('/api/admin/envio-mensajes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantillaId: selectedTemplate._id, destinatarios }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j?.error || `Error ${r.status}`)
      toast.success(`${j.enviados} mensajes enviados${j.fallidos > 0 ? ` · ${j.fallidos} fallaron` : ''}`)
      setResults(j.resultados as SendResult[])
    } catch (e: any) {
      toast.error(e?.message || 'Error en envío')
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setMode(null)
    setSelectedTemplateId('')
    setIndividualInput('')
    setCsvText('')
    setFileName('')
    setLookupItems([])
    setSelectedNumeroIds(new Set())
    setResults(null)
  }

  const itemsToShow = useMemo(
    () => lookupItems.filter(i => !showOnlyValid || i.valido || true /* siempre mostramos inválidos también para diagnóstico, el filtro es informativo */),
    [lookupItems, showOnlyValid],
  )
  const visibleItems = showOnlyValid ? lookupItems.filter(i => i.valido) : lookupItems
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(i => selectedNumeroIds.has(i.numeroId))

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedNumeroIds(s => {
        const next = new Set(s)
        visibleItems.forEach(i => next.delete(i.numeroId))
        return next
      })
    } else {
      setSelectedNumeroIds(s => {
        const next = new Set(s)
        visibleItems.filter(i => i.valido).forEach(i => next.add(i.numeroId))
        return next
      })
    }
  }

  const toggleOne = (id: string) => {
    setSelectedNumeroIds(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <DashboardLayout>
      <PermissionGuard permission={MantenimientoPermission.ENVIO_MENSAJES}>
        <div className="max-w-6xl mx-auto py-6 space-y-4">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-7 w-7 text-amber-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">Envío de Mensajes WhatsApp</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Envío individual o masivo usando plantillas predefinidas. Máximo {MAX_RECIPIENTS} destinatarios por operación.
                </p>
              </div>
              {mode && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Empezar de nuevo
                </button>
              )}
            </div>
          </div>

          {/* Paso 1: Selección de modo */}
          {!mode && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecciona el tipo de envío</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMode('individual')}
                  className="text-left p-5 border-2 border-gray-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <UserIcon className="h-8 w-8 text-indigo-600 mb-2" />
                  <h3 className="font-semibold text-gray-900 mb-1">Individual</h3>
                  <p className="text-sm text-gray-500">Envía a un solo estudiante por su número de documento.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('masivo')}
                  className="text-left p-5 border-2 border-gray-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <UsersIcon className="h-8 w-8 text-indigo-600 mb-2" />
                  <h3 className="font-semibold text-gray-900 mb-1">Masivo</h3>
                  <p className="text-sm text-gray-500">Sube un CSV con la lista de IDs. Máx {MAX_RECIPIENTS} por operación.</p>
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: Plantilla */}
          {mode && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <label htmlFor="plantilla-select" className="block text-sm font-medium text-gray-700 mb-2">
                Plantilla del mensaje
              </label>
              {templatesLoading ? (
                <p className="text-sm text-gray-400">Cargando plantillas…</p>
              ) : templates.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                  No hay plantillas activas. Crea una en{' '}
                  <a href="/admin/plantillas/gestion" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Gestión de Plantillas
                  </a>.
                </div>
              ) : (
                <>
                  <select
                    id="plantilla-select"
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Selecciona —</option>
                    {templates.map(t => (
                      <option key={t._id} value={t._id}>{t.nombre} ({t.slug})</option>
                    ))}
                  </select>
                  {selectedTemplate && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Vista previa (con datos del primer destinatario):</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewMessage}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Paso 3a: Individual — input */}
          {mode === 'individual' && lookupItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <label htmlFor="numero-id-ind" className="block text-sm font-medium text-gray-700 mb-2">
                Número de Documento del estudiante
              </label>
              <div className="flex gap-2">
                <input
                  id="numero-id-ind"
                  type="text"
                  value={individualInput}
                  onChange={e => setIndividualInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') handleIndividualSearch() }}
                  placeholder="Ej: 0703697813 o 18201897-K"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleIndividualSearch}
                  disabled={!individualInput.trim() || lookupLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  {lookupLoading ? 'Buscando…' : 'Buscar'}
                </button>
              </div>
            </div>
          )}

          {/* Paso 3b: Masivo — file upload */}
          {mode === 'masivo' && lookupItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 mb-2">
                Archivo CSV con los numeroIds
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {fileName && (
                <p className="text-xs text-gray-500 mt-2">
                  📄 {fileName} · {csvText.split(/\r?\n/).filter(Boolean).length} línea(s)
                </p>
              )}
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <strong>Formato del CSV:</strong> Una columna con encabezado <code className="bg-white px-1 rounded">numeroId</code>
                {' '}(o aliases: <code>documento</code>, <code>id</code>, <code>cedula</code>). El resto de columnas se ignora.
                Los IDs se normalizan automáticamente (sin espacios, puntos ni guiones).
              </div>
              {csvText && (
                <button
                  type="button"
                  onClick={handleMasivoProcess}
                  disabled={lookupLoading}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  {lookupLoading ? 'Procesando…' : 'Procesar CSV'}
                </button>
              )}
            </div>
          )}

          {/* Paso 4: Lista de destinatarios */}
          {lookupItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Destinatarios ({lookupItems.length})
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Válidos: {lookupItems.filter(i => i.valido).length} · Inválidos: {lookupItems.filter(i => !i.valido).length} · Seleccionados: {selectedNumeroIds.size}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyValid}
                      onChange={e => setShowOnlyValid(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Solo válidos
                  </label>
                </div>
              </div>

              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAll}
                          className="rounded border-gray-300"
                          title={allVisibleSelected ? 'Deseleccionar visibles' : 'Seleccionar todos los visibles válidos'}
                        />
                      </th>
                      <th className="text-left font-medium px-3 py-2">numeroId</th>
                      <th className="text-left font-medium px-3 py-2">Nombre completo</th>
                      <th className="text-left font-medium px-3 py-2">Teléfono</th>
                      <th className="text-left font-medium px-3 py-2">Plataforma</th>
                      <th className="text-left font-medium px-3 py-2">Estado</th>
                      <th className="text-right font-medium px-3 py-2 w-16">—</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map(it => {
                      const checked = selectedNumeroIds.has(it.numeroId)
                      const fullName = `${it.nombre || ''} ${it.primerApellido || ''}`.trim() || '—'
                      return (
                        <tr key={it.numeroId + it.numeroIdOriginal} className={`border-b border-gray-50 last:border-0 ${it.valido ? '' : 'bg-red-50/40'}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!it.valido}
                              onChange={() => toggleOne(it.numeroId)}
                              className="rounded border-gray-300 disabled:opacity-30"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-700">
                            {it.numeroId || it.numeroIdOriginal}
                            {it.numeroIdOriginal !== it.numeroId && it.numeroId && (
                              <div className="text-[10px] text-gray-400">(de: {it.numeroIdOriginal})</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-900">{fullName}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-700">{it.celular || <em className="text-red-600">—</em>}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{it.plataforma || '—'}</td>
                          <td className="px-3 py-2">
                            {it.valido ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                <CheckCircleIcon className="h-3 w-3" /> Listo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium" title={it.error}>
                                <XCircleIcon className="h-3 w-3" /> {it.error}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {/* Botón editar celular solo si tenemos al menos academicaId */}
                            {it.academicaId && (
                              <button
                                type="button"
                                onClick={() => openEditCelular(it)}
                                title="Editar celular"
                                className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paso 5: Confirmación + envío */}
          {lookupItems.length > 0 && !results && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Listo para enviar a <strong>{selectedNumeroIds.size}</strong> destinatario(s)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedTemplate ? `Plantilla: "${selectedTemplate.nombre}"` : 'Selecciona una plantilla arriba'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!selectedTemplate || selectedNumeroIds.size === 0 || sending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                {sending ? 'Enviando…' : `Enviar ${selectedNumeroIds.size} mensajes`}
              </button>
            </div>
          )}

          {/* Paso 6: Resultados */}
          {results && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-200">
                <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                  Envío completado
                </h2>
                <p className="text-sm text-emerald-800 mt-0.5">
                  {results.filter(r => r.ok).length} enviados · {results.filter(r => !r.ok).length} fallidos
                </p>
              </div>
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="text-left font-medium px-3 py-2">numeroId</th>
                      <th className="text-left font-medium px-3 py-2">Nombre</th>
                      <th className="text-left font-medium px-3 py-2">Teléfono</th>
                      <th className="text-left font-medium px-3 py-2">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.numeroId + i} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{r.numeroId}</td>
                        <td className="px-3 py-2">{r.nombre}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.celular}</td>
                        <td className="px-3 py-2">
                          {r.ok ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                              <CheckCircleIcon className="h-3 w-3" /> Enviado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium" title={r.error}>
                              <XCircleIcon className="h-3 w-3" /> {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Nuevo envío
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal editar celular */}
        {editingCelularFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Actualizar celular</h3>
                <button type="button" onClick={() => setEditingCelularFor(null)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-900">
                <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                Esta acción actualizará el celular en <strong>PEOPLE</strong>, <strong>ACADEMICA</strong> y <strong>USUARIOS_ROLES</strong> simultáneamente.
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  <strong>Estudiante:</strong> {(editingCelularFor.nombre || '') + ' ' + (editingCelularFor.primerApellido || '')}
                  {' · '}
                  <span className="font-mono">{editingCelularFor.numeroId}</span>
                </div>
                <label htmlFor="celular-input" className="block text-xs font-medium text-gray-700 mt-2">
                  Celular (solo dígitos, mín 10)
                </label>
                <input
                  id="celular-input"
                  type="text"
                  inputMode="numeric"
                  value={editingCelularValue}
                  onChange={e => setEditingCelularValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 573001234567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  maxLength={15}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCelularFor(null)}
                  disabled={savingCelular}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveCelular}
                  disabled={savingCelular || editingCelularValue.length < 10}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingCelular ? 'Guardando…' : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </PermissionGuard>
    </DashboardLayout>
  )
}
