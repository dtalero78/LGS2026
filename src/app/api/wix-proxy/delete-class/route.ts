import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

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

    console.log('🗑️ [PostgreSQL] Deleting class booking:', classId)

    const result = await query(
      `DELETE FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1 RETURNING *`,
      [classId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Class record not found' },
        { status: 404 }
      )
    }

    console.log('✅ [PostgreSQL] Class deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully',
      deleted: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error in delete-class API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
