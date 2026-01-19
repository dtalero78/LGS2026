import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { step, nivel, studentsData } = body

    console.log('🤖 Generate Session Activities Proxy:', { step, nivel, studentsCount: studentsData?.length })

    // Log detallado de hobbies de cada estudiante
    console.log('🎨 ===== HOBBIES DE ESTUDIANTES (NEXT.JS) =====')
    if (studentsData && Array.isArray(studentsData)) {
      studentsData.forEach((student: any, index: number) => {
        console.log(`${index + 1}. ${student.nombre || student.primerNombre || 'Sin nombre'}:`)
        console.log(`   - Hobbies: "${student.hobbies || '(vacío)'}"`)
        console.log(`   - País: ${student.plataforma || 'Sin país'}`)
        console.log(`   - Edad: ${student.edad || 'Sin edad'}`)
      })
    }
    console.log('🎨 ============================================')

    if (!step) {
      return NextResponse.json(
        { error: 'step is required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/generateSessionActivities`
    console.log('🤖 Making request to:', wixUrl)

    const response = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step, nivel, studentsData })
    })

    console.log('🤖 Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)

      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status} ${response.statusText}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('✅ Session activities generated successfully')
    return NextResponse.json(data)

  } catch (error) {
    console.error('🤖 Generate Session Activities Proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
