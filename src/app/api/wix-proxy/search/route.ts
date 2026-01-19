import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const WIX_API_KEY = process.env.WIX_API_KEY
const WIX_SECRET = process.env.WIX_SECRET

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('searchTerm')

    console.log('🔍 Search Proxy: searchTerm =', searchTerm)
    console.log('🔍 Search Proxy: WIX_API_BASE_URL =', WIX_API_BASE_URL)

    if (!searchTerm) {
      return NextResponse.json(
        { error: 'searchTerm parameter is required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/search?q=${encodeURIComponent(searchTerm)}`
    console.log('🔍 Search Proxy: Making request to =', wixUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (WIX_API_KEY) {
      headers['Authorization'] = `Bearer ${WIX_API_KEY}`
    }

    if (WIX_SECRET) {
      headers['X-Wix-Secret'] = WIX_SECRET
    }

    console.log('🔍 Search Proxy: Headers =', Object.keys(headers))

    const response = await fetch(wixUrl, {
      method: 'GET',
      headers,
    })

    console.log('🔍 Search Proxy: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      // Return empty results instead of error to allow fallback searches
      return NextResponse.json({
        success: false,
        data: { people: [], academica: [] },
        totalCount: 0,
        error: `Wix API error: ${response.status} ${response.statusText}`
      })
    }

    const data = await response.json()
    console.log('🔍 Search Proxy: Success, data =', JSON.stringify(data, null, 2))
    return NextResponse.json(data)

  } catch (error) {
    console.error('🔍 Search Proxy error:', error)
    // Return empty results instead of error to allow fallback searches
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: 'Internal server error'
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query, tipoUsuario } = body

    console.log('🔍 Search Proxy POST: query =', query)
    console.log('🔍 Search Proxy POST: tipoUsuario =', tipoUsuario)
    console.log('🔍 Search Proxy POST: WIX_API_BASE_URL =', WIX_API_BASE_URL)

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    // Si hay tipoUsuario pero no query, usar endpoint especializado
    if (tipoUsuario && (!query || query.trim() === '')) {
      console.log('🔍 Search Proxy POST: Using specialized query for tipoUsuario =', tipoUsuario)

      // Hacer consulta directa por tipoUsuario (simulando todos los contratos)
      const searchQuery = 'LGS' // Buscar por algo genérico que esté en la mayoría de contratos
      const wixUrl = `${WIX_API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`
      console.log('🔍 Search Proxy POST: Making request to =', wixUrl)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (WIX_API_KEY) {
        headers['Authorization'] = `Bearer ${WIX_API_KEY}`
      }

      if (WIX_SECRET) {
        headers['X-Wix-Secret'] = WIX_SECRET
      }

      const response = await fetch(wixUrl, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        // Filtrar por tipoUsuario en el cliente
        if (data.data && data.data.people) {
          data.data.people = data.data.people.filter((person: any) => person.tipoUsuario === tipoUsuario)
        }
        console.log('🔍 Search Proxy POST: Filtered results count =', data.data?.people?.length || 0)
        return NextResponse.json(data)
      } else {
        const errorText = await response.text()
        console.error('Wix API error:', response.status, response.statusText, errorText)
        return NextResponse.json({
          success: false,
          data: { people: [], academica: [] },
          totalCount: 0,
          error: `Wix API error: ${response.status} ${response.statusText}`
        })
      }
    }

    // Si no hay query, devolver todos los usuarios del tipo especificado
    const searchQuery = query || ''
    const wixUrl = `${WIX_API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`
    console.log('🔍 Search Proxy POST: Making request to =', wixUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (WIX_API_KEY) {
      headers['Authorization'] = `Bearer ${WIX_API_KEY}`
    }

    if (WIX_SECRET) {
      headers['X-Wix-Secret'] = WIX_SECRET
    }

    const response = await fetch(wixUrl, {
      method: 'GET',
      headers,
    })

    console.log('🔍 Search Proxy POST: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      // Return empty results instead of error to allow fallback searches
      return NextResponse.json({
        success: false,
        data: { people: [], academica: [] },
        totalCount: 0,
        error: `Wix API error: ${response.status} ${response.statusText}`
      })
    }

    const data = await response.json()

    // Si se especificó un tipoUsuario, filtrar los resultados
    if (tipoUsuario && data.data && data.data.people) {
      data.data.people = data.data.people.filter((person: any) => person.tipoUsuario === tipoUsuario)
    }

    console.log('🔍 Search Proxy POST: Success, filtered data count =', data.data?.people?.length || 0)
    return NextResponse.json(data)

  } catch (error) {
    console.error('🔍 Search Proxy POST error:', error)
    // Return empty results instead of error to allow fallback searches
    return NextResponse.json({
      success: false,
      data: { people: [], academica: [] },
      totalCount: 0,
      error: 'Internal server error'
    })
  }
}