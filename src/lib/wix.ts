// Wix API integration utilities
export const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

// Helper function to make Wix API calls
export async function makeWixApiCall(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
  const url = `${WIX_API_BASE_URL}/${endpoint}`

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store', // Disable Next.js fetch cache
  }

  if (data && method === 'POST') {
    options.body = JSON.stringify(data)
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(`Wix API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Wix API call failed:', error)
    throw error
  }
}

// Search functions
export async function searchByName(searchTerm: string) {
  return makeWixApiCall(`searchByName?searchTerm=${encodeURIComponent(searchTerm)}`)
}

export async function searchByDocument(numeroId: string) {
  return makeWixApiCall(`searchByDocument?numeroId=${encodeURIComponent(numeroId)}`)
}

export async function searchByContract(contrato: string) {
  return makeWixApiCall(`searchByContract?contrato=${encodeURIComponent(contrato)}`)
}

// Student functions
export async function getStudentById(studentId: string) {
  // Use PostgreSQL endpoint
  const baseUrl = process.env.NODE_ENV === 'production'
    ? (process.env.NEXTAUTH_URL || '')
    : 'http://localhost:3001'

  const fullUrl = `${baseUrl}/api/postgres/students/${encodeURIComponent(studentId)}`;
  console.log('🔍 [PostgreSQL] getStudentById - Fetching from URL:', fullUrl);

  const response = await fetch(fullUrl, {
    cache: 'no-store', // Disable Next.js fetch cache to always get fresh data
  })

  console.log('🔍 [PostgreSQL] getStudentById - Response status:', response.status);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const result = await response.json()

  // Transform PostgreSQL response to match expected format
  if (result.success && result.data) {
    return {
      success: true,
      student: result.data,
      classes: [] // Classes will be loaded separately
    }
  }

  return result
}

export async function getStudentClasses(studentId: string) {
  // Use PostgreSQL endpoint
  const baseUrl = process.env.NODE_ENV === 'production'
    ? (process.env.NEXTAUTH_URL || '')
    : 'http://localhost:3001'

  const fullUrl = `${baseUrl}/api/postgres/students/${encodeURIComponent(studentId)}/academic`;
  console.log('🔍 [PostgreSQL] getStudentClasses - Fetching from URL:', fullUrl);

  const response = await fetch(fullUrl, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const result = await response.json()

  // Transform PostgreSQL response to match expected format
  if (result.success && result.data) {
    return {
      success: true,
      classes: result.data.classes || []
    }
  }

  return result
}

// Person functions
export async function getPersonById(personId: string) {
  // SOLUTION: Always use localhost in development, it works for both client and server
  const baseUrl = process.env.NODE_ENV === 'production'
    ? (process.env.NEXTAUTH_URL || '')
    : 'http://localhost:3001'

  const response = await fetch(`${baseUrl}/api/wix-proxy/person-by-id?id=${encodeURIComponent(personId)}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return await response.json()
}

export async function getFinancialDataByContract(contrato: string) {
  return makeWixApiCall(`financialDataByContrato?contrato=${encodeURIComponent(contrato)}`)
}

// Academic functions
export async function getTotalAcademicaUsers() {
  return makeWixApiCall('getTotalAcademicaUsers', 'POST')
}

export async function getAgendaData() {
  return makeWixApiCall('getAgendaData')
}

// Update functions
export async function updateClass(classData: any) {
  return makeWixApiCall('updateClass', 'POST', classData)
}

export async function updateOnHold(onHoldData: any) {
  return makeWixApiCall('updateOnHold', 'POST', onHoldData)
}

export async function createStepOverride(stepData: any) {
  return makeWixApiCall('createStepOverride', 'POST', stepData)
}

export async function deleteStepOverride(stepData: any) {
  return makeWixApiCall('deleteStepOverride', 'POST', stepData)
}