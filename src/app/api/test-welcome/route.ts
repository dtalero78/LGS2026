import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Test Welcome Events endpoint')

    return NextResponse.json({
      success: true,
      message: 'Welcome Events endpoint is working',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Test error:', error)
    return NextResponse.json(
      { success: false, error: 'Test failed' },
      { status: 500 }
    )
  }
}