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
  // SOLUTION: Always use localhost in development, it works for both client and server
  const baseUrl = process.env.NODE_ENV === 'production'
    ? (process.env.NEXTAUTH_URL || '')
    : 'http://localhost:3001'

  const fullUrl = `${baseUrl}/api/wix-proxy/student-by-id?id=${encodeURIComponent(studentId)}`;
  console.log('🔍 getStudentById - Fetching from URL:', fullUrl);

  const response = await fetch(fullUrl, {
    cache: 'no-store', // Disable Next.js fetch cache to always get fresh data
  })

  console.log('🔍 getStudentById - Response status:', response.status);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return await response.json()
}

export async function getStudentClasses(studentId: string) {
  return makeWixApiCall(`studentClasses?id=${encodeURIComponent(studentId)}`)
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