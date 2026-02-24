'use client'

import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface Doc {
  url: string
  nombre: string
  tipo?: string
  fechaSubida?: string
}

interface PersonDocumentsProps {
  documents: Doc[]
}

export default function PersonDocuments({ documents }: PersonDocumentsProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <DocumentTextIcon className="h-10 w-10 mx-auto mb-2" />
        <p className="text-sm">Sin documentos subidos</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Documentos ({documents.length})
      </h3>
      <ul className="divide-y divide-gray-100">
        {documents.map((doc, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            {doc.tipo?.startsWith('image/') ? (
              <img
                src={doc.url}
                alt={doc.nombre}
                className="h-12 w-12 rounded object-cover flex-shrink-0 border border-gray-200"
              />
            ) : (
              <div className="h-12 w-12 rounded bg-red-50 flex items-center justify-center flex-shrink-0 border border-red-100">
                <DocumentTextIcon className="h-6 w-6 text-red-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-800 hover:text-primary-600 truncate block"
              >
                {doc.nombre}
              </a>
              {doc.fechaSubida && (
                <p className="text-xs text-gray-400">
                  {new Date(doc.fechaSubida).toLocaleString('es-CO')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
