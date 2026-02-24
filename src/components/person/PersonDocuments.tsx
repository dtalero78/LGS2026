'use client'

import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface DocObject {
  url: string
  nombre: string
  tipo?: string
  fechaSubida?: string
}

interface PersonDocumentsProps {
  documents: (string | DocObject)[]
}

/** Convert Wix image URI to a viewable URL */
function resolveWixUrl(wixUri: string): string {
  // wix:image://v1/{hash}~mv2.jpeg/filename#originWidth=...
  const match = wixUri.match(/wix:image:\/\/v1\/([^/]+)\//)
  if (match) {
    return `https://static.wixstatic.com/media/${match[1]}`
  }
  return wixUri
}

/** Extract filename from Wix URI or return fallback */
function extractName(wixUri: string): string {
  // wix:image://v1/hash/Filename.jpeg#...
  const match = wixUri.match(/\/([^/#]+?)(?:#|$)/)
  if (match) return decodeURIComponent(match[1])
  return 'Documento'
}

/** Normalize any doc entry to a uniform shape */
function normalizeDoc(entry: string | DocObject): DocObject {
  if (typeof entry === 'string') {
    return {
      url: resolveWixUrl(entry),
      nombre: extractName(entry),
      tipo: entry.includes('.pdf') ? 'application/pdf' : 'image/jpeg',
    }
  }
  return entry
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

  const docs = documents.map(normalizeDoc)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Documentos ({docs.length})
      </h3>
      <ul className="divide-y divide-gray-100">
        {docs.map((doc, i) => (
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
