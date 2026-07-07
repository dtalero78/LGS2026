'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PencilSquareIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

type Tipo = 'multiple_choice' | 'true_false' | 'fill_blank' | 'sentence'
interface Pregunta { tipo: Tipo; enunciado: string; opciones?: string[] }
interface Resultado { correcto: boolean; respuestaCorrecta: number | boolean | string; explicacion?: string }

export default function EjerciciosInteractivosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [nivel, setNivel] = useState(''); const [step, setStep] = useState('')
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [answers, setAnswers] = useState<any[]>([])
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [score, setScore] = useState<{ correctas: number; total: number; porcentaje: number; aprobado: boolean; consejo: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true); setResultados(null); setScore(null)
    try {
      const r = await fetch('/api/postgres/panel-estudiante/ejercicios-interactivos', { cache: 'no-store' })
      const j = await r.json()
      if (j?.available) {
        setAvailable(true)
        setNivel(j.nivel || ''); setStep(j.step || '')
        setPreguntas(j.preguntas || [])
        setAnswers(new Array((j.preguntas || []).length).fill(undefined))
      } else {
        setAvailable(false)
        setMsg(j?.featureActive === false
          ? 'La práctica interactiva no está activa por ahora.'
          : 'Aún no hay ejercicios disponibles para tu step.')
      }
    } catch {
      setAvailable(false); setMsg('No se pudo cargar la práctica. Intenta de nuevo.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const setAnswer = (i: number, v: any) => setAnswers(prev => { const n = [...prev]; n[i] = v; return n })

  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await fetch('/api/postgres/panel-estudiante/ejercicios-interactivos/grade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const j = await r.json()
      if (!r.ok) { alert(j?.error || 'Error al calificar'); return }
      setResultados(j.resultados || [])
      setScore({ correctas: j.correctas, total: j.total, porcentaje: j.porcentaje, aprobado: Boolean(j.aprobado), consejo: j.consejo || '' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { alert('Error al calificar. Intenta de nuevo.') }
    finally { setSubmitting(false) }
  }

  const reintentar = () => { setResultados(null); setScore(null); setAnswers(new Array(preguntas.length).fill(undefined)) }

  const graded = resultados !== null
  const allAnswered = answers.every(a => a !== undefined && a !== '')

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push('/panel-estudiante')} className="p-2 rounded-lg hover:bg-gray-200" title="Volver">
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <PencilSquareIcon className="h-7 w-7 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ejercicios de práctica</h1>
            {available && <p className="text-xs text-gray-500">{nivel} · {step} · sin nota, para practicar</p>}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto" />
            <p className="mt-3 text-gray-500 text-sm">Preparando tus ejercicios...</p>
          </div>
        ) : !available ? (
          <div className="bg-white rounded-xl border p-10 text-center">
            <PencilSquareIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600">{msg}</p>
          </div>
        ) : (
          <>
            {/* Score banner + consejo IA */}
            {score && (
              <div className={`rounded-xl p-4 mb-4 border ${score.aprobado ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${score.aprobado ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                    {score.aprobado ? '✓ Aprobado' : 'Sigue practicando'}
                  </span>
                  <p className={`text-lg font-bold ${score.aprobado ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {score.correctas}/{score.total} ({score.porcentaje}%)
                  </p>
                </div>
                {score.consejo && (
                  <p className={`text-sm mt-2 ${score.aprobado ? 'text-emerald-900' : 'text-amber-900'}`}>{score.consejo}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Se aprueba con 70%. Es práctica — repite las veces que quieras.</p>
              </div>
            )}

            {/* Preguntas */}
            <div className="space-y-4">
              {preguntas.map((q, i) => {
                const res = resultados?.[i]
                return (
                  <div key={i} className={`bg-white rounded-xl border p-4 ${graded ? (res?.correcto ? 'border-emerald-300' : 'border-red-300') : 'border-gray-200'}`}>
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-xs font-bold text-gray-400 mt-0.5">{i + 1}</span>
                      <p className="text-sm font-medium text-gray-900 flex-1">{q.enunciado}</p>
                      {graded && (res?.correcto
                        ? <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
                        : <XCircleIcon className="h-5 w-5 text-red-500 shrink-0" />)}
                    </div>

                    {/* Multiple choice */}
                    {q.tipo === 'multiple_choice' && (
                      <div className="space-y-1.5">
                        {(q.opciones || []).map((op, oi) => {
                          const selected = answers[i] === oi
                          const isCorrect = graded && Number(res?.respuestaCorrecta) === oi
                          return (
                            <button key={oi} type="button" disabled={graded}
                              onClick={() => setAnswer(i, oi)}
                              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors
                                ${isCorrect ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                  : selected ? (graded ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-400')
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} ${graded ? 'cursor-default' : ''}`}>
                              {op}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* True / False */}
                    {q.tipo === 'true_false' && (
                      <div className="flex gap-2">
                        {[{ v: true, l: 'Verdadero' }, { v: false, l: 'Falso' }].map(({ v, l }) => {
                          const selected = answers[i] === v
                          const isCorrect = graded && Boolean(res?.respuestaCorrecta) === v
                          return (
                            <button key={l} type="button" disabled={graded}
                              onClick={() => setAnswer(i, v)}
                              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                                ${isCorrect ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                  : selected ? (graded ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-400')
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} ${graded ? 'cursor-default' : ''}`}>
                              {l}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Fill in the blank */}
                    {q.tipo === 'fill_blank' && (
                      <input type="text" disabled={graded}
                        value={answers[i] ?? ''} onChange={e => setAnswer(i, e.target.value)}
                        placeholder="Escribe tu respuesta..."
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${graded ? (res?.correcto ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-gray-300 focus:ring-2 focus:ring-amber-400'}`} />
                    )}

                    {/* Sentence — construcción de frase (evaluada por IA) */}
                    {q.tipo === 'sentence' && (
                      <textarea disabled={graded} rows={2}
                        value={answers[i] ?? ''} onChange={e => setAnswer(i, e.target.value)}
                        placeholder="Escribe tu oración completa en inglés..."
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${graded ? (res?.correcto ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-gray-300 focus:ring-2 focus:ring-amber-400'}`} />
                    )}

                    {/* Feedback tras calificar */}
                    {graded && res && !res.correcto && (
                      <p className="mt-2 text-xs text-emerald-700">
                        {q.tipo === 'sentence' ? 'Ejemplo de respuesta: ' : 'Respuesta correcta: '}
                        <strong>{
                          q.tipo === 'multiple_choice' ? (q.opciones?.[Number(res.respuestaCorrecta)] ?? '')
                          : q.tipo === 'true_false' ? (res.respuestaCorrecta ? 'Verdadero' : 'Falso')
                          : String(res.respuestaCorrecta)
                        }</strong>
                      </p>
                    )}
                    {graded && res?.explicacion && (
                      <p className="mt-1 text-xs text-gray-500">{res.explicacion}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Acciones */}
            <div className="mt-5 flex gap-3">
              {!graded ? (
                <button onClick={submit} disabled={submitting || !allAnswered}
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50">
                  {submitting ? 'Revisando...' : allAnswered ? 'Revisar respuestas' : 'Responde todas para revisar'}
                </button>
              ) : (
                <>
                  <button onClick={reintentar}
                    className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 flex items-center justify-center gap-2">
                    <ArrowPathIcon className="h-5 w-5" /> Reintentar
                  </button>
                  <button onClick={() => router.push('/panel-estudiante')}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">
                    Volver
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
