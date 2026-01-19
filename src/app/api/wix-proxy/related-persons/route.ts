import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const WIX_API_KEY = process.env.WIX_API_KEY
const WIX_SECRET = process.env.WIX_SECRET

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personId, tipoUsuario, titularId } = body

    console.log('🔍 Related Persons Proxy:', { personId, tipoUsuario, titularId })

    if (!personId) {
      return NextResponse.json(
        { error: 'personId is required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/getRelatedPersons`

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
      body: JSON.stringify({ personId, tipoUsuario, titularId })
    })

    console.log('🔍 Related Persons Proxy: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)
      return NextResponse.json({
        success: false,
        relatedPersons: [],
        error: `Wix API error: ${response.status} ${response.statusText}`
      })
    }

    const data = await response.json()
    console.log('🔍 Related Persons Proxy: Success, data =', data)
    return NextResponse.json(data)

  } catch (error) {
    console.error('🔍 Related Persons Proxy error:', error)
    return NextResponse.json({
      success: false,
      relatedPersons: [],
      error: 'Internal server error'
    })
  }
}