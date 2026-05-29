'use client'

import Link from 'next/link'
import { AcademicCapIcon } from '@heroicons/react/24/outline'
import { useJumpEligibility } from '@/hooks/use-jump-tutor'

/**
 * Shown on the student panel only when the student is at the Jump step of their
 * level and may take the oral Jump exam with the voice tutor.
 */
export default function JumpExamBanner() {
  const { data } = useJumpEligibility()
  const elig = data?.eligibility
  if (!elig?.eligible) return null

  return (
    <Link
      href="/panel-estudiante/jump-tutor"
      className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <AcademicCapIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-indigo-900">
            ¡Listo para tu examen Jump{elig.nivel ? ` de ${elig.nivel}` : ''}!
          </p>
          <p className="text-sm text-indigo-700">
            Evaluación oral en inglés con tu tutor virtual (~5–8 min).
          </p>
        </div>
      </div>
      <span className="hidden rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white sm:block">
        Iniciar
      </span>
    </Link>
  )
}
