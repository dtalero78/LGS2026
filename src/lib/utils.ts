import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Date formatting utilities
export function formatDate(date: string | Date): string {
  if (!date) return ''

  const d = new Date(date)
  // Use UTC to ensure consistency between server and client
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')

  return `${day}/${month}/${year}`
}

export function formatDateTime(date: string | Date): string {
  if (!date) return ''

  const d = new Date(date)
  // Detect user's timezone automatically and format like Wix original
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    // Use user's local timezone instead of hardcoded one
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  // Detect user's locale or fallback to Spanish
  const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'es'
  const locale = userLocale.startsWith('es') ? 'es' : 'es' // Default to Spanish for LGS

  return d.toLocaleString(locale, options).replace(/,/g, '')
}

// Server-side version with fixed Colombia timezone (for Server Components)
export function formatDateTimeColombia(date: string | Date): string {
  if (!date) return ''

  const d = new Date(date)
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota'
  }

  return d.toLocaleString('es-CO', options).replace(/,/g, '')
}

// Currency formatting
export function formatCurrency(amount: number, currency: string = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Text utilities
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function capitalizeFirst(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

// Type guards
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null
}

// Array utilities
export function groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key])
    if (!result[group]) {
      result[group] = []
    }
    result[group].push(item)
    return result
  }, {} as Record<string, T[]>)
}

// Environment utilities
export function getEnvironmentVariable(name: string, defaultValue?: string): string {
  const value = process.env[name]
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${name} is required`)
  }
  return value || defaultValue || ''
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

// Mock data toggle
export function shouldUseRealData(): boolean {
  return process.env.USE_REAL_WIX_DATA === 'true'
}

export function isAuthDisabled(): boolean {
  // IMPORTANTE: Solo deshabilitar auth si está EXPLÍCITAMENTE en 'true'
  // El valor del .env.local tiene prioridad
  const disableAuth = process.env.DISABLE_AUTH
  console.log('🔍 isAuthDisabled check:', { disableAuth, result: disableAuth === 'true' })
  return disableAuth === 'true'
}

export function isDbDisabled(): boolean {
  return process.env.DISABLE_DB === 'true'
}