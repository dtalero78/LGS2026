import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function POST(request: NextRequest) {
  try {
    console.log('📊 Dashboard Stats: Fetching from PostgreSQL')

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Run all queries in parallel for better performance
    const [
      totalUsuariosResult,
      totalInactivosResult,
      sesionesHoyResult,
      usuariosInscritosHoyResult,
      advisorsHoyResult
    ] = await Promise.all([
      // Total usuarios en ACADEMICA
      query(`SELECT COUNT(*) as count FROM "ACADEMICA"`),

      // Total usuarios activos (estadoInactivo = false or null)
      query(`SELECT COUNT(*) as count FROM "ACADEMICA" WHERE "estadoInactivo" = false OR "estadoInactivo" IS NULL`),

      // Sesiones agendadas hoy (eventos en CALENDARIO para hoy)
      query(`
        SELECT COUNT(*) as count
        FROM "CALENDARIO"
        WHERE "dia" >= $1 AND "dia" < $2
      `, [today.toISOString(), tomorrow.toISOString()]),

      // Usuarios inscritos hoy (registros en ACADEMICA_BOOKINGS para hoy)
      query(`
        SELECT COUNT(*) as count
        FROM "ACADEMICA_BOOKINGS"
        WHERE "_createdDate" >= $1 AND "_createdDate" < $2
      `, [today.toISOString(), tomorrow.toISOString()]),

      // Advisors únicos con eventos hoy
      query(`
        SELECT COUNT(DISTINCT "advisor") as count
        FROM "CALENDARIO"
        WHERE "dia" >= $1 AND "dia" < $2
      `, [today.toISOString(), tomorrow.toISOString()])
    ])

    const stats = {
      totalUsuarios: parseInt(totalUsuariosResult.rows[0]?.count || '0'),
      totalInactivos: parseInt(totalInactivosResult.rows[0]?.count || '0'),
      sesionesHoy: parseInt(sesionesHoyResult.rows[0]?.count || '0'),
      usuariosInscritosHoy: parseInt(usuariosInscritosHoyResult.rows[0]?.count || '0'),
      advisorsHoy: parseInt(advisorsHoyResult.rows[0]?.count || '0')
    }

    console.log('📊 Dashboard Stats: PostgreSQL results:', stats)

    return NextResponse.json({
      success: true,
      stats,
      source: 'postgres'
    })
  } catch (error: any) {
    console.error('📊 Dashboard Stats Error:', error.message)

    return NextResponse.json({
      success: true,
      stats: {
        totalUsuarios: 0,
        totalInactivos: 0,
        sesionesHoy: 0,
        usuariosInscritosHoy: 0,
        advisorsHoy: 0
      },
      source: 'fallback',
      error: error.message
    })
  }
}
