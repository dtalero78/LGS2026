import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.WIX_API_BASE_URL || process.env.NEXT_PUBLIC_WIX_API_BASE_URL
const WIX_API_KEY = process.env.WIX_API_KEY
const WIX_SECRET = process.env.WIX_SECRET

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    console.log('🔍 Student By ID Proxy: id =', id)

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      )
    }

    if (!WIX_API_BASE_URL) {
      return NextResponse.json(
        { error: 'WIX API configuration is missing' },
        { status: 500 }
      )
    }

    const wixUrl = `${WIX_API_BASE_URL}/studentById?id=${encodeURIComponent(id)}`

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
      cache: 'no-store', // Disable Next.js fetch cache to always get fresh data
    })

    console.log('🔍 Student By ID Proxy: Response status =', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Wix API error:', response.status, response.statusText, errorText)
      return NextResponse.json({
        success: false,
        error: `Wix API error: ${response.status} ${response.statusText}`
      })
    }

    const data = await response.json()
    console.log('🔍 Student By ID Proxy: Success')
    return NextResponse.json(data)

  } catch (error) {
    console.error('🔍 Student By ID Proxy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    })
  }
}