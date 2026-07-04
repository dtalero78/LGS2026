'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ComercialPermission } from '@/types/permissions'
import { ArrowLeft, ExternalLink, User, AlertCircle, GraduationCap, Users } from 'lucide-react'

interface Titular {
  _id: string
  primerNombre: string; segundoNombre?: string; primerApellido: string; segundoApellido?: string
  numeroId: string; contrato: string; plataforma: string; celular: string; email: string
  domicilio?: string; ciudad?: string; fechaNacimiento?: string
  aprobacion?: string; estado?: string; estadoMatricula?: string
  asesorAsignado?: string
  inicioContrato?: string | Date; finalContrato?: string | Date; vigencia?: string | number
}
interface Beneficiario {
  _id: string
  primerNombre: string; segundoNombre?: string; primerApellido: string; segundoApellido?: string
  numeroId: string; celular: string; email: string; plataforma: string; fechaNacimiento?: string
  academicaId?: string | null; nivel?: string; step?: string; academicaInactivo?: boolean
  tienePerfilAcademico?: boolean
}

const nombre = (p: any) => `${p.primerNombre || ''} ${p.primerApellido || ''}`.trim()
const inicial = (p: any) => (p.primerNombre || p.primerApellido || '?').charAt(0).toUpperCase()
const fmtFecha = (v: any) => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

function estadoBadge(estado?: string) {
  const e = (estado || '').toLowerCase()
  if (e.includes('aprobado') || e.includes('aprobada')) return 'bg-green-100 text-green-800'
  if (e.includes('firmado')) return 'bg-orange-100 text-orange-800'
  if (e.includes('pendiente')) return 'bg-yellow-100 text-yellow-800'
  if (e.includes('revisión') || e.includes('revision')) return 'bg-blue-100 text-blue-800'
  if (e.includes('rechaz')) return 'bg-red-100 text-red-800'
  return 'bg-gray-200 text-gray-700' // Sin aprobar / Sin firmar
}

export default function MatriculaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [titular, setTitular] = useState<Titular | null>(null)
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/postgres/matriculas/${id}`, { cache: 'no-store' })
        const j = await r.json()
        if (!r.ok) { setError(j?.error || 'No se pudo cargar la matrícula'); return }
        setTitular(j.titular); setBeneficiarios(j.beneficiarios || [])
      } catch { setError('Error al cargar la matrícula') } finally { setLoading(false) }
    })()
  }, [id])

  return (
    <DashboardLayout>
      <PermissionGuard permission={ComercialPermission.MATRICULAS_DETALLE} showDefaultMessage>
        <div className="max-w-6xl mx-auto space-y-6 py-2">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.back()} title="Volver" className="p-2 rounded-lg hover:bg-gray-200">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Resumen de Matrícula</h1>
              {titular && <p className="text-sm text-gray-500">Contrato {titular.contrato} · {titular.plataforma}</p>}
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" /><p className="mt-3 text-gray-500 text-sm">Cargando...</p></div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
          ) : titular && (
            <>
              {/* Tarjeta del TITULAR */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-4 flex items-start justify-between">
                  <div className="flex items-center gap-3 text-white">
                    <div className="h-14 w-14 rounded-full bg-white/25 flex items-center justify-center text-xl font-bold ring-2 ring-white/40">{inicial(titular)}</div>
                    <div>
                      <div className="text-xs uppercase tracking-wide opacity-80">Titular</div>
                      <div className="text-lg font-bold leading-tight">{nombre(titular)}</div>
                      <div className="text-xs opacity-90">ID {titular.numeroId} · {titular.contrato}</div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoBadge(titular.estadoMatricula)}`} title="Estado de la matrícula (aprobación)">
                    {titular.estadoMatricula}
                  </span>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <Field label="Documento" value={titular.numeroId} />
                  <Field label="Plataforma" value={titular.plataforma} />
                  <Field label="Asesor" value={titular.asesorAsignado || '—'} />
                  <Field label="Celular" value={titular.celular} />
                  <Field label="Email" value={titular.email} />
                  <Field label="Fecha de nacimiento" value={fmtFecha(titular.fechaNacimiento)} />
                  <Field label="Domicilio" value={titular.domicilio || '—'} />
                  <Field label="Ciudad" value={titular.ciudad || '—'} />
                  <Field label="Vigencia (meses)" value={String(titular.vigencia ?? '—')} />
                  <Field label="Inicio contrato" value={fmtFecha(titular.inicioContrato)} />
                  <Field label="Fin contrato" value={fmtFecha(titular.finalContrato)} />
                  <div className="flex items-end">
                    <a href={`/person/${titular._id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver ficha completa
                    </a>
                  </div>
                </div>
              </div>

              {/* Beneficiarios */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-500" /> Beneficiarios ({beneficiarios.length})
                </h2>

                {beneficiarios.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No hay beneficiarios</p>
                    <p className="text-xs text-gray-400 mt-0.5">Este contrato no tiene beneficiarios registrados.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {beneficiarios.map(b => {
                      const conPerfil = !!b.tienePerfilAcademico
                      return (
                        <div key={b._id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                          <div className={`px-4 py-3 flex items-center gap-3 text-white ${conPerfil ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}>
                            <div className="h-11 w-11 rounded-full bg-white/25 flex items-center justify-center text-lg font-bold ring-2 ring-white/40 shrink-0">{inicial(b)}</div>
                            <div className="min-w-0">
                              <div className="font-bold leading-tight truncate">{nombre(b)}</div>
                              <div className="text-[11px] opacity-90">ID {b.numeroId}</div>
                            </div>
                          </div>
                          <div className="p-4 text-sm space-y-1.5 flex-1">
                            <Field label="Celular" value={b.celular || '—'} />
                            <Field label="Email" value={b.email || '—'} />
                            <Field label="Plataforma" value={b.plataforma || '—'} />
                            <Field label="Fecha de nacimiento" value={fmtFecha(b.fechaNacimiento)} />

                            {conPerfil ? (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5">
                                  <GraduationCap className="h-4 w-4" /> Perfil académico
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  <Field label="Nivel" value={b.nivel || '—'} />
                                  <Field label="Step" value={b.step || '—'} />
                                  <div className="col-span-2">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.academicaInactivo ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                                      {b.academicaInactivo ? 'Académica: Inactiva' : 'Académica: Activa'}
                                    </span>
                                  </div>
                                </div>
                                <a href={`/student/${b.academicaId}`} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800">
                                  <ExternalLink className="h-3.5 w-3.5" /> Ver alumno
                                </a>
                              </div>
                            ) : (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                  <AlertCircle className="h-3.5 w-3.5" /> Usuario aún no tiene perfil académico
                                </span>
                                <a href={`/person/${b._id}`} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800">
                                  <ExternalLink className="h-3.5 w-3.5" /> Ver ficha
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PermissionGuard>
    </DashboardLayout>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-gray-800 break-words">{value}</div>
    </div>
  )
}
