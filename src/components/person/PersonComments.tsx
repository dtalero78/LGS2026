'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Comment {
  id: string
  usuario: string
  fecha: string
  texto: string
  areaDestinatario?: string
  areaRemitente?: string
}

interface PersonCommentsProps {
  personId: string
}

const AREAS = [
  { value: 'General', label: 'General', color: 'bg-gray-100 text-gray-800' },
  { value: 'Administrativo', label: 'Administrativo', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'Academico', label: 'Académico', color: 'bg-blue-100 text-blue-800' },
  { value: 'Servicio', label: 'Servicio', color: 'bg-purple-100 text-purple-800' },
  { value: 'Comercial', label: 'Comercial (Ventas/Asesor)', color: 'bg-orange-100 text-orange-800' },
  { value: 'Recaudos', label: 'Recaudos (Cobranza)', color: 'bg-green-100 text-green-800' },
]

export default function PersonComments({ personId }: PersonCommentsProps) {
  const { data: session, status } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [areaDestinatario, setAreaDestinatario] = useState('General')
  const [areaRemitente, setAreaRemitente] = useState('General')
  const [filterArea, setFilterArea] = useState('Todos')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('🔐 Session status:', status, 'Session data:', session)
  }, [session, status])

  useEffect(() => {
    loadComments()
  }, [personId])

  const loadComments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/wix-proxy/person-comments?id=${personId}`)
      const data = await response.json()

      if (data.success) {
        setComments(data.comments || [])
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error('Error loading comments:', err)
      setError('Error al cargar comentarios')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim()) {
      return
    }

    const userEmail = session?.user?.email || (session?.user as any)?.name || 'admin@lgs.com'

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/wix-proxy/add-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personId,
          commentData: {
            usuario: userEmail,
            texto: newComment.trim(),
            areaDestinatario: areaDestinatario,
            areaRemitente: areaRemitente
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setNewComment('')
        setAreaDestinatario('General')
        setAreaRemitente('General')
        await loadComments()
      } else {
        setError(data.error || 'Error al agregar comentario')
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
      setError('Error al enviar comentario')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const filteredComments = filterArea === 'Todos'
    ? comments
    : comments.filter(comment => comment.areaDestinatario === filterArea)

  return (
    <div className="space-y-6 pb-32">
      <h3 className="text-lg font-medium text-gray-900">💬 Sistema de Comentarios</h3>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="areaRemitente" className="block text-sm font-medium text-gray-700 mb-2">
              Enviado desde (Remitente)
            </label>
            <select
              id="areaRemitente"
              value={areaRemitente}
              onChange={(e) => setAreaRemitente(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              {AREAS.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="areaDestinatario" className="block text-sm font-medium text-gray-700 mb-2">
              Dirigido a (Destinatario)
            </label>
            <select
              id="areaDestinatario"
              value={areaDestinatario}
              onChange={(e) => setAreaDestinatario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              {AREAS.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
            Agregar Comentario
          </label>
          <textarea
            id="comment"
            rows={4}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario sobre este usuario..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none relative z-0"
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Enviando...' : 'Agregar Comentario'}
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Comentarios ({filteredComments.length})
          </h4>

          {/* Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <label htmlFor="filterArea" className="text-sm font-medium text-gray-700">
              Filtrar por:
            </label>
            <select
              id="filterArea"
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Todos">Todos</option>
              {AREAS.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-sm text-gray-500">Cargando comentarios...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">
              {comments.length === 0
                ? 'No hay comentarios aún. ¡Sé el primero en comentar!'
                : `No hay comentarios para el área "${AREAS.find(a => a.value === filterArea)?.label}"`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {comment.usuario.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{comment.usuario}</p>
                      <p className="text-xs text-gray-500">{formatDate(comment.fecha)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    {comment.areaRemitente && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        AREAS.find(a => a.value === comment.areaRemitente)?.color || 'bg-gray-100 text-gray-800'
                      }`}>
                        📤 {AREAS.find(a => a.value === comment.areaRemitente)?.label || comment.areaRemitente}
                      </span>
                    )}
                    {comment.areaDestinatario && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        AREAS.find(a => a.value === comment.areaDestinatario)?.color || 'bg-gray-100 text-gray-800'
                      }`}>
                        📥 {AREAS.find(a => a.value === comment.areaDestinatario)?.label || comment.areaDestinatario}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}