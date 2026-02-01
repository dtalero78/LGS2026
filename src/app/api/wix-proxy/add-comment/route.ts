import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-postgres'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personId, commentData } = body

    if (!personId || !commentData) {
      return NextResponse.json(
        { success: false, error: 'personId y commentData son requeridos' },
        { status: 400 }
      )
    }

    console.log('💬 [PostgreSQL] Adding comment to person:', personId)

    // Get session for user info
    const session = await getServerSession(authOptions)

    // Get current person data
    const personResult = await query(
      `SELECT "_id", "comentarios"
       FROM "PEOPLE"
       WHERE "_id" = $1`,
      [personId]
    )

    if (personResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      )
    }

    const person = personResult.rows[0]

    // Parse existing comments
    let comments = Array.isArray(person.comentarios)
      ? person.comentarios
      : JSON.parse(person.comentarios || '[]')

    // Create new comment entry
    const newComment = {
      id: `comment_${Date.now()}`,
      fecha: new Date().toISOString(),
      texto: commentData.texto || commentData.comment || commentData,
      autor: session?.user?.name || session?.user?.email || 'Unknown',
      tipo: commentData.tipo || 'general'
    }

    comments.push(newComment)

    // Update person
    const result = await query(
      `UPDATE "PEOPLE"
       SET "comentarios" = $1::jsonb,
           "_updatedDate" = NOW()
       WHERE "_id" = $2
       RETURNING *`,
      [JSON.stringify(comments), personId]
    )

    console.log('✅ [PostgreSQL] Comment added successfully')

    return NextResponse.json({
      success: true,
      comment: newComment,
      person: result.rows[0]
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Add comment error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
