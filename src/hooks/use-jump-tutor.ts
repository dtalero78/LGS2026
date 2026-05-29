'use client'

import { useQuery } from 'react-query'
import { api } from './use-api'

const BASE = '/api/postgres/panel-estudiante/jump-tutor'

export interface JumpEligibility {
  eligible: boolean
  reason?: string
  nivel: string | null
  jumpStep: string | null
  attemptsUsed: number
  maxAttempts: number
}

/** Whether the logged-in student can take the Jump exam right now. */
export function useJumpEligibility() {
  return useQuery<{ success: boolean; eligibility: JumpEligibility }>(
    ['jump-tutor', 'eligibility'],
    () => api.get(`${BASE}/eligibility`),
    { staleTime: 5 * 60 * 1000 }
  )
}
