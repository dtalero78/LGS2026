'use client'

import { useEffect, useState } from 'react'
import { Person } from '@/types'
import { formatDate } from '@/lib/utils'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentTextIcon, PhotoIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { PermissionGuard } from '@/components/permissions'
import { PersonPermission } from '@/types/permissions'
import { api, handleApiError } from '@/hooks/use-api'
import toast from 'react-hot-toast'
import PersonContractViewer from './PersonContractViewer'
import SuspendidaBadge from '@/components/common/SuspendidaBadge'
import DocumentosReciboModal from '@/components/common/DocumentosReciboModal'

interface PersonGeneralProps {
  person: Person
  /** Si true, muestra el badge "SUSPENDIDA" en la fila de botones. */
  isSuspendida?: boolean
}

export default function PersonGeneral({ person, isSuspendida }: PersonGeneralProps) {
  const [showDocuments, setShowDocuments] = useState(false)
  const [showRecibo, setShowRecibo] = useState(false)
  const [showDocReciboModal, setShowDocReciboModal] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])

  // Recibo de inscripción (PEOPLE.reciboInscripcion, INDEPENDIENTE de la documentación).
  const reciboInsc = (() => {
    const raw = (person as any).reciboInscripcion
    if (!raw) return null
    if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
    return raw
  })()

  // Descargar contrato PDF
  const downloadContrato = () => {
    if (!person._id) {
      alert('No se puede descargar el contrato: ID no disponible')
      return
    }
    // Endpoint unificado: respeta el interruptor bsl/LGS de archivado.
    window.open(`/api/contracts/${person._id}/download-pdf`, '_blank')
  }

  // Ver documentación
  const viewDocuments = () => {
    setShowDocuments(true)
  }

  const [docs, setDocs] = useState(() => {
    const rawDocs: any[] = (person as any).documentacion || []
    return rawDocs.map((entry: any) => {
      if (typeof entry === 'string') {
        const urlMatch = entry.match(/wix:image:\/\/v1\/([^/]+)\//)
        const url = urlMatch ? `https://static.wixstatic.com/media/${urlMatch[1]}` : entry
        const nameMatch = entry.match(/\/([^/#]+?)(?:#|$)/)
        const nombre = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Documento'
        const tipo = entry.includes('.pdf') ? 'application/pdf' : 'image/jpeg'
        return { url, nombre, tipo }
      }
      return entry as { url: string; nombre: string; tipo?: string; fechaSubida?: string }
    })
  })

  const handleFileUpload = async (files: File[]) => {
    if (!files.length) return
    for (const file of files) {
      setUploadingFiles(prev => [...prev, file.name])
      try {
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch(`/api/contracts/${person._id}/upload-url`, {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error(err.error || `Upload failed: ${uploadRes.status}`)
        }
        const { publicUrl } = await uploadRes.json()
        const saved = await api.post(`/api/contracts/${person._id}/documents`, {
          url: publicUrl,
          nombre: file.name,
          tipo: file.type,
        })
        setDocs(saved.documentacion || [])
        toast.success(`${file.name} subido`)
      } catch (err) {
        handleApiError(err, `Error subiendo ${file.name}`)
      } finally {
        setUploadingFiles(prev => prev.filter(n => n !== file.name))
      }
    }
  }

  const openFileChooser = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      handleFileUpload(Array.from(input.files || []))
      document.body.removeChild(input)
    })
    input.click()
  }

  // ── Programa Kids (solo beneficiarios Kids) ──
  // `kidsInscripcion` lo adjunta el API de people/[id] desde KIDS_INSCRIPCIONES.
  const esKids = (person as any).kids === true
  const ki = (person as any).kidsInscripcion || null

  // Estado real del niño en KIDS2026 (situacion CURSANDO/SUSPENDIDO/NO_CURSANDO).
  // Se consulta aparte para que KIDS lento/caído no frene la ficha.
  const [kidsEstado, setKidsEstado] = useState<any | null>(null)
  const [kidsEstadoLoading, setKidsEstadoLoading] = useState(false)
  useEffect(() => {
    if (!esKids || !person._id) return
    let cancel = false
    setKidsEstadoLoading(true)
    fetch(`/api/postgres/people/${person._id}/kids-estado`)
      .then(r => r.json())
      .then(d => { if (!cancel) setKidsEstado(d) })
      .catch(() => { if (!cancel) setKidsEstado({ estado: 'ERROR', mensaje: 'No se pudo consultar KIDS' }) })
      .finally(() => { if (!cancel) setKidsEstadoLoading(false) })
    return () => { cancel = true }
  }, [esKids, person._id])

  const KIDS_SITUACION: Record<string, { label: string; cls: string }> = {
    CURSANDO: { label: 'KIDS: Cursando', cls: 'bg-green-100 text-green-800 border-green-200' },
    SUSPENDIDO: { label: 'KIDS: Suspendido (contrato en pausa)', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    NO_CURSANDO: { label: 'KIDS: No cursando', cls: 'bg-red-100 text-red-800 border-red-200' },
  }
  const kidsFilas: { label: string; value: string }[] = ki
    ? ([
        ['Campaña', ki.campaign],
        ['Curso', ki.tipoCurso],
        ['Salón', ki.salonNombre],
        ['Horario', ki.horario],
        ['Apoderado', [ki.apoderado, ki.apoderadoApellidos].filter(Boolean).join(' ').trim()],
        ['Documento apoderado', ki.apoderadoDoc],
        ['Parentesco', ki.parentesco],
        ['Teléfono apoderado', ki.apoderadoTelefono],
        ['Correo apoderado', ki.apoderadoMail],
      ] as Array<[string, any]>)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([label, value]) => ({ label, value: String(value) }))
    : []

  return (
    <div className="space-y-8">
      {/* Action Buttons + Suspendida badge */}
      <div className="flex items-center flex-wrap gap-3">
        <PermissionGuard permission={PersonPermission.VER_CONTRATO}>
          <PersonContractViewer person={person as any} />
        </PermissionGuard>
        <PermissionGuard permission={PersonPermission.DESCARGAR_CONTRATO}>
          <button
            onClick={downloadContrato}
            className="btn-primary flex items-center space-x-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Descargar Contrato</span>
          </button>
        </PermissionGuard>
        <PermissionGuard permission={PersonPermission.VER_DOCUMENTACION}>
          <button
            onClick={() => setShowDocReciboModal(true)}
            className="btn-secondary flex items-center space-x-2"
            title="Ver, subir documentación y recibo"
          >
            <DocumentTextIcon className="h-4 w-4" />
            <span>Documentación y recibo</span>
          </button>
        </PermissionGuard>
        <SuspendidaBadge
          show={!!isSuspendida}
          suspenddata={person.suspenddata ?? null}
          suspendcount={person.suspendcount}
        />
      </div>

      {/* Main Layout - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Personal Data */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">👤 Datos Personales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Primer Nombre</label>
              <p className="mt-1 text-sm text-gray-900">{person.primerNombre || 'No especificado'}</p>
            </div>
            {person.segundoNombre && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Segundo Nombre</label>
                <p className="mt-1 text-sm text-gray-900">{person.segundoNombre}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Primer Apellido</label>
              <p className="mt-1 text-sm text-gray-900">{person.primerApellido || 'No especificado'}</p>
            </div>
            {person.segundoApellido && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Segundo Apellido</label>
                <p className="mt-1 text-sm text-gray-900">{person.segundoApellido}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Número de Documento</label>
              <p className="mt-1 text-sm text-gray-900">{person.numeroId}</p>
            </div>
            {person.fechaNacimiento && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(person.fechaNacimiento)}</p>
              </div>
            )}
            {person.plataforma && (
              <div>
                <label className="block text-sm font-medium text-gray-700">País/Plataforma</label>
                <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {person.plataforma}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Contact and Location */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">📍 Contacto y Ubicación</h3>
          <div className="space-y-4">
            {person.celular && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Celular</label>
                <p className="mt-1 text-sm text-gray-900">{person.celular}</p>
              </div>
            )}
            {person.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{person.email}</p>
              </div>
            )}
            {person.domicilio && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Domicilio</label>
                <p className="mt-1 text-sm text-gray-900">{person.domicilio}</p>
              </div>
            )}
            {person.ciudad && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Ciudad</label>
                <p className="mt-1 text-sm text-gray-900">{person.ciudad}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Programa Kids (beneficiarios Kids) */}
      {esKids && (
        <div>
          <h3 className="text-lg font-medium text-fuchsia-700 mb-4 flex items-center gap-2">
            🧒 Programa Kids
          </h3>
          {/* Estado en KIDS2026 (situacion) */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {kidsEstadoLoading ? (
              <span className="text-sm text-gray-500 italic">Consultando estado en KIDS…</span>
            ) : kidsEstado?.estado === 'OK' && kidsEstado.situacion && KIDS_SITUACION[kidsEstado.situacion] ? (
              <>
                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold ${KIDS_SITUACION[kidsEstado.situacion].cls}`}>
                  {KIDS_SITUACION[kidsEstado.situacion].label}
                </span>
                {kidsEstado.detalle && <span className="text-sm text-gray-600">{kidsEstado.detalle}</span>}
              </>
            ) : kidsEstado?.estado === 'SIN_REGISTRO' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold bg-gray-100 text-gray-700 border-gray-200">
                Sin registro en KIDS
              </span>
            ) : kidsEstado ? (
              <span className="text-sm text-gray-500 italic">
                Estado KIDS no disponible{kidsEstado.mensaje ? ` — ${kidsEstado.mensaje}` : ''}
              </span>
            ) : null}
          </div>
          {kidsFilas.length > 0 ? (
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {kidsFilas.map(f => (
                  <div key={f.label}>
                    <label className="block text-sm font-medium text-gray-700">{f.label}</label>
                    <p className="mt-1 text-sm text-gray-900 break-words">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Beneficiario Kids — sin detalle de inscripción registrado.</p>
          )}
        </div>
      )}

      {/* System Details */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Detalles del Sistema</h4>
        <div className="text-xs text-gray-500 space-y-1">
          <p>• ID del Sistema: {person._id}</p>
          <p>• Fecha de Registro: {formatDate(person.fechaCreacion)}</p>
          <p>• Última Actualización: {formatDate(person.fechaCreacion)}</p>
        </div>
      </div>

      {/* Modal unificado Documentación + Recibo (mismo de Matrículas) */}
      <DocumentosReciboModal
        open={showDocReciboModal}
        personId={person._id ?? null}
        subtitulo={`${[person.primerNombre, person.primerApellido].filter(Boolean).join(' ')}${person.contrato ? ` · Contrato ${person.contrato}` : ''}`}
        onClose={() => setShowDocReciboModal(false)}
      />
    </div>
  )
}

function getEstadoBadgeClass(estado: string): string {
  switch (estado) {
    case 'Aprobado':
      return 'badge-success'
    case 'Pendiente':
      return 'badge-warning'
    case 'Rechazado':
      return 'badge-danger'
    case 'Contrato nulo':
      return 'badge-danger'
    case 'Devuelto':
      return 'badge-warning'
    default:
      return 'badge-info'
  }
}