import { NextRequest, NextResponse } from 'next/server'
import { WIX_API_BASE_URL } from '@/lib/wix'

export async function POST(request: NextRequest) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const wixUrl = `${WIX_API_BASE_URL}/getTopStudentsThisMonth`

    console.log('🏆 Top Students: Calling Wix API:', wixUrl)

    const response = await fetch(wixUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      console.log('🏆 Top Students: Wix response:', data)

      if (data.success && data.topStudents) {
        return NextResponse.json({
          success: true,
          topStudents: data.topStudents,
          source: 'wix'
        })
      } else {
        console.log('🏆 Top Students: Wix returned error, using fallback')
        return NextResponse.json({
          success: true,
          topStudents: [],
          source: 'fallback'
        })
      }
    } else {
      console.log(`🏆 Top Students: HTTP ${response.status}, using fallback`)
      return NextResponse.json({
        success: true,
        topStudents: [],
        source: 'fallback'
      })
    }
  } catch (error: any) {
    console.error('🏆 Top Students Error:', error.message)

    return NextResponse.json({
      success: true,
      topStudents: [],
      source: 'fallback',
      error: error.message
    })
  }
}