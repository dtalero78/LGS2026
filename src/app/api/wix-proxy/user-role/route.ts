/**
 * API Route: Get user role from PostgreSQL
 * Queries USUARIOS_ROLES table to verify user and get their role
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json(
      { success: false, error: 'Email es requerido' },
      { status: 400 }
    )
  }

  try {
    console.log('🔍 [PostgreSQL] Consultando rol del usuario:', email)

    const result = await query(
      `SELECT * FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1)`,
      [email]
    )

    if (result.rowCount === 0) {
      console.log('⚠️ [PostgreSQL] Usuario no encontrado:', email)
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const user = result.rows[0]

    if (!user.activo) {
      console.log('⚠️ [PostgreSQL] Usuario inactivo:', email)
      return NextResponse.json(
        { success: false, error: 'Usuario inactivo' },
        { status: 403 }
      )
    }

    console.log('✅ [PostgreSQL] Usuario encontrado:', {
      email: user.email,
      rol: user.rol,
      activo: user.activo
    })

    return NextResponse.json({
      success: true,
      email: user.email,
      rol: user.rol,
      activo: user.activo,
      nombre: user.nombre
    })

  } catch (error: any) {
    console.error('❌ [PostgreSQL] Error al consultar rol del usuario:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
