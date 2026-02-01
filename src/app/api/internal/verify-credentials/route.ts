import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import bcrypt from 'bcryptjs'

/**
 * Internal API for verifying user credentials
 * This endpoint is used by auth.ts to verify credentials against PostgreSQL
 * without importing the pg module directly (which causes client-side issues)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    console.log('🔍 [Internal Auth] Verifying credentials for:', email)

    const result = await query(
      `SELECT "_id", "email", "password", "nombre", "rol", "activo"
       FROM "USUARIOS_ROLES"
       WHERE "email" = $1`,
      [email]
    )

    if (result.rowCount === 0) {
      console.log('⚠️ [Internal Auth] User not found')
      return NextResponse.json({
        success: false,
        error: 'User not found'
      })
    }

    const user = result.rows[0]

    if (!user.activo) {
      console.log('⚠️ [Internal Auth] User inactive')
      return NextResponse.json({
        success: false,
        error: 'User inactive'
      })
    }

    console.log('✅ [Internal Auth] User found:', {
      email: user.email,
      rol: user.rol,
      activo: user.activo
    })

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        password: user.password,
        nombre: user.nombre,
        rol: user.rol,
        activo: user.activo
      }
    })

  } catch (error) {
    console.error('❌ [Internal Auth] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
