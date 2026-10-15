'use client'

import { useState, useEffect } from 'react'
import { Student } from '@/types'
import StudentOnHold from './StudentOnHold'
import ExtensionVigencia from './ExtensionVigencia'
import {
  ChartBarIcon,
  ArrowPathIcon,
  TrashIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  AcademicCapIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'

// ── helpers de formato ─────────────────────────────────────────────────────
function fmtFechaAudit(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

interface StudentContractProps {
  student: Student
  contratoFinalizado?: boolean
}

interface BookingSnap {
  _id: string
  fechaEvento: string
  hora: string
  advisorNombre: string
  nivel: string
  step: string
}

interface UltimosAgendamientos {
  ultimaSesion: BookingSnap | null
  ultimoJump: BookingSnap | null
  ultimoClub: BookingSnap | null
}

// ── helpers ────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  return hora
}

// ── sub-componente: fila de booking ────────────────────────────────────────

function BookingRow({
  label,
  color,
  booking,
}: {
  label: string
  color: string
  booking: BookingSnap | null
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {booking ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-gray-700">
            <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{fmtFecha(booking.fechaEvento)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700">
            <ClockIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{fmtHora(booking.hora)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700 col-span-2">
            <UserIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{booking.advisorNombre || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-700 col-span-2">
            <AcademicCapIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="font-medium">{booking.nivel}</span>
            <span className="text-gray-400">·</span>
            <span>{booking.step}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">Sin registros</p>
      )}
    </div>
  )
}



// ── componente principal ───────────────────────────────────────────────────

export default function StudentContract({ student, contratoFinalizado = false }: StudentContractProps) {
  const [agendamientos, setAgendamientos] = useState<UltimosAgendamientos | null>(null)
  const [loadingAgend, setLoadingAgend] = useState(true)
  const [titularNombre, setTitularNombre] = useState<string | null>(null)
  const [auditData, setAuditData] = useState<{
    cambioStepHistory: any[] | null
    inicianivel: any | null
    clrhistoric: any | null
  } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/postgres/students/${student._id}/ultimos-agendamientos`)
        const json = await res.json()
        if (json.success) setAgendamientos(json)
      } catch { /* silencioso */ }
      finally { setLoadingAgend(false) }
    }
    load()
  }, [student._id])

  useEffect(() => {
    const loadAudit = async () => {
      try {
        const res = await fetch(`/api/postgres/students/${student._id}/academic-audit`)
        const json = await res.json()
        if (json.success) setAuditData(json)
      } catch { /* silencioso */ }
    }
    loadAudit()
  }, [student._id])

  // Cargar nombre del titular: 1° por titularId, 2° por contrato (fallback para datos Wix)
  useEffect(() => {
    const loadTitular = async () => {
      // Intento 1: titularId directo (PEOPLE _id)
      const titularId = (student as any).titularId
      if (titularId) {
        try {
          const res = await fetch(`/api/postgres/people/${titularId}`)
          const json = await res.json()
          if (json.success && json.person) {
            const p = json.person
            const nombre = [p.primerNombre, p.primerApellido].filter(Boolean).join(' ')
            if (nombre) { setTitularNombre(nombre); return }
          }
        } catch { /* continuar con intento 2 */ }
      }

      // Intento 2: buscar TITULAR por número de contrato (fallback datos Wix)
      if (student.contrato) {
        try {
          const res = await fetch(`/api/postgres/contracts/search?pattern=${encodeURIComponent(student.contrato)}&exact=true`)
          const json = await res.json()
          const contract = json.contracts?.[0]
          if (contract?.titular) {
            const t = contract.titular
            const nombre = [t.primerNombre, t.primerApellido].filter(Boolean).join(' ')
            if (nombre) setTitularNombre(nombre)
          }
        } catch { /* silencioso — usará fallback */ }
      }
    }
    loadTitular()
  }, [(student as any).titularId, student.contrato])

  return (
    <div className="space-y-6">

      {/* ── Fila 1: Extensión de Vigencia + OnHold (igual altura) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

        {/* Extensión de Vigencia */}
        <ExtensionVigencia
          peopleId={student.peopleId || student._id}
          nombre={`${student.primerNombre} ${student.primerApellido}`}
          finalContrato={student.finalContrato}
          vigencia={student.vigencia}
          extensionCount={student.extensionCount}
          extensionHistory={student.extensionHistory as any[] | undefined}
        />

        {/* Estado OnHold */}
        <StudentOnHold
          studentId={student._id}
          peopleId={(student as any).peopleId || null}
          numeroId={student.numeroId || ''}
          estadoInactivo={!!(student as any).estadoInactivo}
          currentFechaOnHold={(student as any).fechaOnHold}
          currentFechaFinOnHold={(student as any).fechaFinOnHold}
          onHoldCount={(student as any).onHoldCount}
          onHoldHistory={(student as any).onHoldHistory}
        />
      </div>

      {/* ── Fila 2: 3 tarjetas con datos reales de ACADEMICA ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Gestión Académica Nivel — cambioStepHistory */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/70">
              <ChartBarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-800">Gestión Académica Nivel</h4>
          </div>
          {!auditData ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xs text-gray-400 italic">Cargando...</p>
            </div>
          ) : !auditData.cambioStepHistory || auditData.cambioStepHistory.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xs text-gray-400 italic text-center">Sin registros de cambio de step</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-48">
              {[...auditData.cambioStepHistory].reverse().map((e: any, i: number) => (
                <div key={i} className="bg-white/80 rounded-lg px-3 py-2 text-xs space-y-0.5">
                  <p className="font-medium text-gray-800">
                    {e.stepAnterior} → {e.stepNuevo}
                    {e.nivelNuevo && e.nivelNuevo !== e.nivelAnterior && (
                      <span className="text-blue-600 ml-1">({e.nivelNuevo})</span>
                    )}
                  </p>
                  <p className="text-gray-600 flex items-center gap-1">
                    <UserCircleIcon className="w-3 h-3" /> {e.autorizadoPor || '—'}
                  </p>
                  <p className="text-gray-500 flex items-center gap-1">
                    <CalendarDaysIcon className="w-3 h-3" /> {fmtFechaAudit(e.fecha)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reiniciar Nivel — inicianivel */}
        <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/70">
              <ArrowPathIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h4 className="font-semibold text-gray-800">Reiniciar Nivel</h4>
          </div>
          {!auditData ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xs text-gray-400 italic">Cargando...</p>
            </div>
          ) : !auditData.inicianivel ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xs text-gray-400 italic text-center">Sin registros de reinicio</p>
            </div>
          ) : (
            <div className="bg-white/80 rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="font-medium text-gray-800">
                {auditData.inicianivel.nivel} — {auditData.inicianivel.stepAnterior} → {auditData.inicianivel.stepNuevo}
              </p>
              <p className="text-gray-600">
                Bookings eliminados: <strong>{auditData.inicianivel.bookingsEliminados}</strong>
              </p>
              <p className="text-gray-600 flex items-center gap-1">
                <UserCircleIcon className="w-3 h-3" /> {auditData.inicianivel.autorizadoPor || '—'}
              </p>
              <p className="text-gray-500 flex items-center gap-1">
                <CalendarDaysIcon className="w-3 h-3" /> {fmtFechaAudit(auditData.inicianivel.fecha)}
              </p>
            </div>
          )}
        </div>

        {/* Borrado Histórico — clrhistoric */}
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/70">
              <TrashIcon className="w-5 h-5 text-red-600" />
            </div>
            <h4 className="font-semibold text-gray-800">Borrado Histórico</h4>
          </div>
          {!auditData ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xs text-gray-400 italic">Cargando...</p>
            </div>
          ) : !auditData.clrhistoric ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <p className="text-xs text-gray-400 italic text-center">Sin registros de borrado</p>
            </div>
          ) : (
            <div className="bg-white/80 rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="text-gray-600">
                Bookings eliminados: <strong>{auditData.clrhistoric.bookingsEliminados ?? 0}</strong>
              </p>
              <p className="text-gray-600">
                Complementarias eliminadas: <strong>{auditData.clrhistoric.complementariasEliminadas ?? 0}</strong>
              </p>
              <p className="text-gray-600">
                Step Overrides eliminados: <strong>{auditData.clrhistoric.stepOverridesEliminados ?? 0}</strong>
              </p>
              <p className="text-gray-600 flex items-center gap-1">
                <UserCircleIcon className="w-3 h-3" /> {auditData.clrhistoric.autorizadoPor || '—'}
              </p>
              <p className="text-gray-500 flex items-center gap-1">
                <CalendarDaysIcon className="w-3 h-3" /> {fmtFechaAudit(auditData.clrhistoric.fecha)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 3: Últimos Agendamientos (ancho completo) ─────────────── */}
      <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5 space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-white/70">
            <CalendarDaysIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <h4 className="font-semibold text-gray-800">Últimos Agendamientos</h4>
        </div>
        {loadingAgend ? (
          <div className="py-6 text-center text-sm text-gray-400">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BookingRow
              label="Última sesión asistida"
              color="bg-white border-blue-100"
              booking={agendamientos?.ultimaSesion ?? null}
            />
            <BookingRow
              label="Último jump aprobado"
              color="bg-white border-purple-100"
              booking={agendamientos?.ultimoJump ?? null}
            />
            <BookingRow
              label="Último club asistido"
              color="bg-white border-green-100"
              booking={agendamientos?.ultimoClub ?? null}
            />
          </div>
        )}
      </div>

      {/* ── Fila 4: Relación con el Estudiante (ancho completo) ────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          Relación con el Estudiante
        </h3>

        <p className="text-sm text-gray-700 leading-relaxed">
          El titular del contrato{' '}
          <strong className={titularNombre ? 'text-gray-900' : 'text-gray-400 italic'}>
            {titularNombre || 'SIN TITULAR'}
          </strong>{' '}
          es el responsable financiero de la educación de{' '}
          <strong className="text-gray-900 uppercase">
            {student.primerNombre} {student.primerApellido}
          </strong>.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Contrato</p>
            <p className="text-sm font-semibold text-gray-900">{student.contrato || '—'}</p>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Fecha inicial</p>
            <p className="text-sm font-semibold text-gray-900">
              {(student as any).fechaContrato
                ? new Date((student as any).fechaContrato).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Vigencia (fecha final)</p>
            <p className={`text-sm font-semibold ${
              student.finalContrato && new Date(student.finalContrato) < new Date()
                ? 'text-red-600' : 'text-gray-900'
            }`}>
              {student.finalContrato
                ? new Date(student.finalContrato).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                : '—'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Beneficiario</p>
            <p className="text-sm font-semibold text-gray-900 uppercase leading-snug">
              {student.primerNombre} {student.primerApellido}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">ID: {student.numeroId}</p>
          </div>
        </div>
      </div>

    </div>
  )
}
