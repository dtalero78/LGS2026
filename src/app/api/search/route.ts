import { NextRequest, NextResponse } from 'next/server'
import { makeWixApiCall } from '@/lib/wix'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const searchTerm = searchParams.get('q')
  const type = searchParams.get('type') || 'name'

  if (!searchTerm) {
    return NextResponse.json({
      success: false,
      error: 'Search term is required'
    }, { status: 400 })
  }

  try {
    let endpoint: string

    switch (type) {
      case 'document':
        endpoint = `searchByDocument?numeroId=${encodeURIComponent(searchTerm)}`
        break
      case 'contract':
        endpoint = `searchByContract?contrato=${encodeURIComponent(searchTerm)}`
        break
      case 'name':
      default:
        endpoint = `searchByName?searchTerm=${encodeURIComponent(searchTerm)}`
        break
    }

    const result = await makeWixApiCall(endpoint)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      data: { people: [], academica: [] },
      totalCount: 0
    }, { status: 500 })
  }
}