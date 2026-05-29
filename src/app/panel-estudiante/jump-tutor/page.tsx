'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useJumpEligibility } from '@/hooks/use-jump-tutor'
import JumpTutorCall from '@/components/panel-estudiante/JumpTutorCall'

export default function JumpTutorPage() {
  const router = useRouter()
  const { data, isLoading } = useJumpEligibility()
  const elig = data?.eligibility

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => router.push('/panel-estudiante')}
        className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Volver al panel
      </button>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">Examen Jump</h1>
      <p className="mb-6 text-gray-600">
        El examen Jump evalúa tu dominio del nivel completo en una conversación en inglés con tu tutor virtual.
      </p>

      {isLoading && <p className="text-gray-500">Verificando elegibilidad…</p>}

      {!isLoading && elig && !elig.eligible && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-medium text-amber-800">Aún no puedes presentar el examen Jump</p>
          <p className="mt-1 text-sm text-amber-700">{elig.reason}</p>
        </div>
      )}

      {!isLoading && elig?.eligible && (
        <>
          {elig.attemptsUsed > 0 && (
            <p className="mb-3 text-sm text-gray-500">
              Intentos usados: {elig.attemptsUsed} / {elig.maxAttempts}
            </p>
          )}
          <JumpTutorCall />
        </>
      )}
    </div>
  )
}
