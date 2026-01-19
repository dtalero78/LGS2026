import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const WIX_API_KEY = process.env.WIX_API_KEY
const WIX_SECRET = process.env.WIX_SECRET

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      idEstudiante,
      idEvento,
      asistencia,
      participacion,
      noAprobo,
      calificacion,
      comentarios,
      advisorAnotaciones,
      actividadPropuesta,
      nivel,
      step
    } = body

    console.log('📝 Update Class Record Proxy:', {
      idEstudiante,
      idEvento,
      asistencia,
      participacion,
      noAprobo,
      calificacion
    })

    if (!idEstudiante || !idEvento) {
      return NextResponse.json(
        { error: 'idEstudiante and idEvento are required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/updateClassRecord`
    console.log('📝 Update Class Record Proxy: Making request to =', wixUrl)

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
      method: 'POST',
      headers,
      body: JSON.stringify({
        idEstudiante,
        idEvento,
        asistencia,
        participacion,
        noAprobo,
        calificacion,
        comentarios,
        advisorAnotaciones,
        actividadPropuesta,
        nivel,
        step
      })
    })

    console.log('📝 Update Class Record Proxy: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status} ${response.statusText}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('✅ Update Class Record Proxy: Success')
    return NextResponse.json(data)

  } catch (error) {
    console.error('📝 Update Class Record Proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
