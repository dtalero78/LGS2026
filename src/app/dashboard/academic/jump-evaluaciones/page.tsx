'use client'

import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { AcademicoPermission } from '@/types/permissions'
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface JumpEval {
  _id: string
  nivel: string
  jumpStep: string
  numeroId: string | null
  plataforma: string | null
  score: number | null
  recomendacion: 'APROBAR' | 'REPROBAR' | 'REVISAR' | null
  criterios: Record<string, number> | null
  fortalezas: string[] | null
  debilidades: string[] | null
  resumen: string | null
  durationSec: number | null
  reviewStatus: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
  reviewedBy: string | null
  _createdDate: string
}

const RECO_STYLE: Record<string, string> = {
  APROBAR: 'bg-green-100 text-green-800',
  REPROBAR: 'bg-red-100 text-red-800',
  REVISAR: 'bg-amber-100 text-amber-800',
}

function Content() {
  const [items, setItems] = useState<JumpEval[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDIENTE')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/postgres/jump-evaluaciones?reviewStatus=${encodeURIComponent(filter)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al cargar')
      setItems(json.evaluaciones || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const review = async (id: string, decision: 'APROBADO' | 'RECHAZADO') => {
    const nota = decision === 'RECHAZADO'
      ? window.prompt('Motivo del rechazo (opcional):') ?? ''
      : ''
    setBusyId(id)
    try {
      const res = await fetch(`/api/postgres/jump-evaluaciones/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, nota }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error al revisar')
      toast.success(
        decision === 'APROBADO'
          ? json.advancement?.advanced ? 'Aprobado — estudiante avanzó de step' : 'Aprobado — Jump registrado'
          : 'Evaluación rechazada'
      )
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluaciones Jump (Bot Tutor)</h1>
          <p className="text-sm text-gray-500">
            Reportes del examen oral del bot. Al aprobar se crea el booking del Jump y el estudiante avanza.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="PENDIENTE">Pendientes</option>
            <option value="APROBADO">Aprobadas</option>
            <option value="RECHAZADO">Rechazadas</option>
          </select>
          <button onClick={load} className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50">
            <ArrowPathIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-500">Cargando…</p>}
      {!loading && items.length === 0 && (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
          No hay evaluaciones {filter.toLowerCase()}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((it) => (
          <div key={it._id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{it.nivel} · {it.jumpStep}</p>
                <p className="text-xs text-gray-500">
                  ID {it.numeroId || '—'} · {it.plataforma || '—'} · {new Date(it._createdDate).toLocaleString('es')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-700">{it.score ?? '—'}<span className="text-sm text-gray-400">/100</span></div>
                {it.recomendacion && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RECO_STYLE[it.recomendacion]}`}>
                    {it.recomendacion}
                  </span>
                )}
              </div>
            </div>

            {it.criterios && (
              <div className="mb-3 grid grid-cols-5 gap-1 text-center text-xs">
                {Object.entries(it.criterios).map(([k, v]) => (
                  <div key={k} className="rounded bg-gray-50 p-1.5">
                    <div className="font-bold text-gray-800">{v}</div>
                    <div className="capitalize text-gray-500">{k.slice(0, 5)}</div>
                  </div>
                ))}
              </div>
            )}

            {it.resumen && <p className="mb-2 text-sm text-gray-700">{it.resumen}</p>}

            {it.fortalezas?.length ? (
              <p className="mb-1 text-xs text-green-700">✓ {it.fortalezas.join(' · ')}</p>
            ) : null}
            {it.debilidades?.length ? (
              <p className="mb-3 text-xs text-amber-700">△ {it.debilidades.join(' · ')}</p>
            ) : null}

            {it.reviewStatus === 'PENDIENTE' ? (
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <button
                  disabled={busyId === it._id}
                  onClick={() => review(it._id, 'APROBADO')}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4" /> Aprobar Jump
                </button>
                <button
                  disabled={busyId === it._id}
                  onClick={() => review(it._id, 'RECHAZADO')}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircleIcon className="h-4 w-4" /> Rechazar
                </button>
              </div>
            ) : (
              <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
                {it.reviewStatus} {it.reviewedBy ? `· por ${it.reviewedBy}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function JumpEvaluacionesPage() {
  return (
    <DashboardLayout>
      <PermissionGuard permission={AcademicoPermission.JUMP_EVAL_REVISAR} showDefaultMessage>
        <Content />
      </PermissionGuard>
    </DashboardLayout>
  )
}
