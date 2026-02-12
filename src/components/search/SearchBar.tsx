'use client'

import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useQuery } from 'react-query'
import { useRouter } from 'next/navigation'
import { SearchResult } from '@/types'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Debounce: espera 400ms después de que el usuario deja de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results, isLoading } = useQuery<SearchResult>(
    ['search', debouncedQuery],
    () => searchFunction(debouncedQuery),
    {
      enabled: debouncedQuery.length >= 3,
      staleTime: 30000,
    }
  )

  const searchFunction = async (searchTerm: string): Promise<SearchResult> => {
    try {
      const searchFields = {
        PEOPLE: ['primerNombre', 'primerApellido', 'numeroId', 'contrato'],
        ACADEMICA: ['primerNombre', 'primerApellido', 'numeroId', 'contrato (via JOIN PEOPLE)'],
      }
      console.log('🔍 [SearchBar] Buscando:', searchTerm)
      console.log('🔍 [SearchBar] Campos de búsqueda:', searchFields)
      console.log('🔍 [SearchBar] Endpoint:', `/api/postgres/search?searchTerm=${encodeURIComponent(searchTerm)}`)

      const response = await fetch(`/api/postgres/search?searchTerm=${encodeURIComponent(searchTerm)}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      console.log('🔍 [SearchBar] Resultados:', {
        people: data.data?.people?.length || 0,
        academica: data.data?.academica?.length || 0,
        total: data.totalCount,
      })

      // PostgreSQL endpoint returns consistent structure
      return {
        success: data.success,
        data: data.data,
        totalCount: data.totalCount
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Error al buscar. Intenta nuevamente.')
      return {
        success: false,
        data: { people: [], academica: [] },
        totalCount: 0
      }
    }
  }

  const allResults = [
    ...(results?.data?.people || []).map(p => ({
      ...p,
      type: p.tipoUsuario === 'TITULAR' ? 'person' : 'student',
      source: 'people'
    })),
    ...(results?.data?.academica || []).map(s => ({ ...s, type: 'student', source: 'academica' }))
  ]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || allResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < allResults.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleResultClick(allResults[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleResultClick = (result: any) => {
    if (result.type === 'person') {
      // TITULAR goes to /person/ page
      console.log('🔗 Navigating TITULAR to /person/', result._id)
      router.push(`/person/${result._id}`)
    } else {
      // BENEFICIARIO goes to /student/ page
      // Check if this result came from ACADEMICA (has academic type)
      if (result.type === 'student' && result.hasOwnProperty('nivel')) {
        console.log('🔗 Navigating BENEFICIARIO to /student/', result._id, '(direct from ACADEMICA)')
        router.push(`/student/${result._id}`)
      } else {
        // This is a beneficiary from PEOPLE, find corresponding ACADEMICA record
        const academicRecord = results?.data?.academica.find(
          (academic) => academic.numeroId === result.numeroId
        )
        if (academicRecord) {
          console.log('🔗 Navigating BENEFICIARIO to /student/', academicRecord._id, '(from ACADEMICA via PEOPLE)')
          router.push(`/student/${academicRecord._id}`)
        } else {
          console.log('⚠️ No academic record found for beneficiary, navigating to person page instead')
          // If no academic record exists, show this beneficiary in the person page of their titular
          // We need to find the titular first
          const titularRecord = results?.data?.people.find(
            (person) => person.numeroId === result.numeroId && person.tipoUsuario === 'TITULAR'
          )
          if (titularRecord) {
            console.log('🔗 Redirecting to titular page for beneficiary without academic record:', titularRecord._id)
            router.push(`/person/${titularRecord._id}`)
          } else {
            console.log('❌ No titular found for this beneficiary')
            alert('Este beneficiario no tiene registro académico activo ni titular asociado.')
          }
        }
      }
    }
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(-1)
  }

  const clearSearch = () => {
    setQuery('')
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  useEffect(() => {
    setSelectedIndex(-1)
  }, [results])

  // Abrir dropdown cuando hay query >= 3 chars (inmediato, no esperar debounce)
  useEffect(() => {
    setIsOpen(query.length >= 3)
  }, [query])

  // Resultados son stale si el usuario sigue escribiendo (query != debouncedQuery)
  const isDebouncing = query !== debouncedQuery && query.length >= 3

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="block w-full rounded-md border-0 py-2 pl-10 pr-10 text-gray-900 bg-gray-50 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 focus:bg-white sm:text-sm sm:leading-6 transition-all duration-200"
          placeholder="Buscar por nombre, ID o número de contrato..."
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors duration-150" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 max-h-96 overflow-auto z-50">
          {isLoading || isDebouncing ? (
            <div className="p-4 text-center">
              <div className="inline-block w-4 h-4 loading-spinner border-primary-600"></div>
              <span className="ml-2 text-sm text-gray-600">Buscando...</span>
            </div>
          ) : allResults.length > 0 ? (
            <div className="py-2">
              {allResults.map((result, index) => (
                <button
                  key={`${result.type}-${result._id}`}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-150",
                    selectedIndex === index && "bg-primary-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {result.primerNombre} {result.primerApellido}
                        </span>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          result.tipoUsuario === 'TITULAR'
                            ? "bg-primary-100 text-primary-800"
                            : (result as any).source === 'academica'
                            ? "bg-green-100 text-green-800"
                            : "bg-accent-100 text-accent-800"
                        )}>
                          {result.tipoUsuario || ((result as any).source === 'academica' ? 'Registro Académico' : 'Beneficiario')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {result.numeroId}
                        {result.contrato && ` • Contrato: ${result.contrato}`}
                        {result.email && ` • ${result.email}`}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : debouncedQuery.length >= 3 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No se encontraron resultados para &ldquo;{query}&rdquo;
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}