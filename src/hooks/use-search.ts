'use client'

import { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { api } from './use-api'
import { SearchResult } from '@/types'

// ─── Query Keys ───
const keys = {
  search: (term: string) => ['search', term] as const,
}

/**
 * Debounce hook - returns debounced value after delay
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Unified search hook (searches PEOPLE + ACADEMICA)
 * Used by SearchBar component
 */
export function useSearch(term: string, options?: { minLength?: number; debounceMs?: number }) {
  const minLength = options?.minLength ?? 3
  const debouncedTerm = useDebounce(term, options?.debounceMs ?? 400)
  const isDebouncing = term !== debouncedTerm && term.length >= minLength

  const query = useQuery<SearchResult>(
    keys.search(debouncedTerm),
    () => api.get(`/api/postgres/search?searchTerm=${encodeURIComponent(debouncedTerm)}`),
    {
      enabled: debouncedTerm.length >= minLength,
      staleTime: 30000,
    }
  )

  return { ...query, isDebouncing }
}

