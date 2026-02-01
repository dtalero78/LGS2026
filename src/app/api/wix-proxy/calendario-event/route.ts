import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    console.log('🔍 [PostgreSQL] Calendario Event: id =', id)

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      )
    }

    const result = await query(
      `SELECT * FROM "CALENDARIO" WHERE "_id" = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Event not found'
      }, { status: 404 })
    }

    console.log('🔍 [PostgreSQL] Calendario Event: Found event:', result.rows[0].titulo)

    return NextResponse.json({
      success: true,
      event: result.rows[0]
    })

  } catch (error: any) {
    console.error('🔍 [PostgreSQL] Calendario Event error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
