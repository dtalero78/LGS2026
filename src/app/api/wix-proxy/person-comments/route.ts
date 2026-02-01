import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de persona requerido' },
        { status: 400 }
      )
    }

    console.log('💬 [PostgreSQL] Getting comments for person:', id)

    // Get the person's comments field
    const result = await query(
      `SELECT "comentarios" FROM "PEOPLE" WHERE "_id" = $1`,
      [id]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Persona no encontrada' },
        { status: 404 }
      )
    }

    // Parse comments (JSONB array)
    const comentarios = result.rows[0].comentarios || []
    const comments = Array.isArray(comentarios) ? comentarios : JSON.parse(comentarios || '[]')

    console.log('✅ [PostgreSQL] Comments retrieved:', comments.length)

    return NextResponse.json({
      success: true,
      comments: comments
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Person comments error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
