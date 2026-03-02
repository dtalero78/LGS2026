'use client'

import { useQuery, useMutation, useQueryClient } from 'react-query'
import { api, handleApiError } from './use-api'
import toast from 'react-hot-toast'

const BASE = '/api/postgres/panel-estudiante/complementaria'

// ─── Query Keys ───
const keys = {
  eligibility: (step: string) => ['complementaria', 'eligibility', step] as const,
  attempts: (step: string) => ['complementaria', 'attempts', step] as const,
}

// ─── Queries ───

/** Check if student is eligible for complementary activity on a step */
export function useComplementariaEligibility(step: string) {
  return useQuery(
    keys.eligibility(step),
    () => api.get(`${BASE}/eligibility?step=${encodeURIComponent(step)}`),
    { enabled: !!step, staleTime: 5 * 60 * 1000 }
  )
}

/** Fetch previous attempts for a step */
export function useComplementariaAttempts(step: string) {
  return useQuery(
    keys.attempts(step),
    () => api.get(`${BASE}/attempts?step=${encodeURIComponent(step)}`),
    { enabled: !!step }
  )
}

// ─── Mutations ───

/** Generate questions for a complementary activity */
export function useGenerateQuestions() {
  const qc = useQueryClient()
  return useMutation(
    (step: string) => api.post(`${BASE}/generate`, { step }),
    {
      onSuccess: (_data, step) => {
        qc.invalidateQueries(keys.attempts(step))
      },
      onError: (err) => handleApiError(err, 'Error generando preguntas'),
    }
  )
}

/** Grade answers for a complementary activity */
export function useGradeAnswers() {
  const qc = useQueryClient()
  return useMutation(
    (data: { attemptId: string; answers: string[]; step: string }) =>
      api.post(`${BASE}/grade`, { attemptId: data.attemptId, answers: data.answers }),
    {
      onSuccess: (_data, variables) => {
        qc.invalidateQueries(keys.attempts(variables.step))
        qc.invalidateQueries(keys.eligibility(variables.step))
        qc.invalidateQueries(['panel-estudiante', 'progress'])
      },
      onError: (err) => handleApiError(err, 'Error calificando respuestas'),
    }
  )
}
