import { NextRequest, NextResponse } from 'next/server'

const WIX_API_BASE_URL = process.env.NEXT_PUBLIC_WIX_API_BASE_URL || 'https://www.lgsplataforma.com/_functions'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('id')

    if (!classId) {
      return NextResponse.json(
        { success: false, error: 'Class ID parameter is required' },
        { status: 400 }
      )
    }

    console.log('🗑️ Deleting class:', classId)

    const response = await fetch(
      `${WIX_API_BASE_URL}/deleteClass?id=${encodeURIComponent(classId)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.error('❌ Wix API error:', response.status, response.statusText)
      return NextResponse.json(
        { success: false, error: `Wix API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Class deleted successfully:', data)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Error in delete-class API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}