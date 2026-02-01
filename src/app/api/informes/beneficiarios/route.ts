import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/postgres'

/**
 * POST /api/informes/beneficiarios
 * Obtiene todos los beneficiarios en un rango de fechas con su total de sesiones
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { fechaInicio, fechaFin } = body

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json(
        { error: 'fechaInicio y fechaFin son requeridos' },
        { status: 400 }
      )
    }

    console.log('📊 [PostgreSQL] Generando informe de beneficiarios:', { fechaInicio, fechaFin })

    // Get beneficiaries with session counts in date range
    const result = await query(
      `SELECT
        p."_id",
        p."primerNombre",
        p."segundoNombre",
        p."primerApellido",
        p."segundoApellido",
        p."numeroId",
        p."email",
        p."celular",
        p."nivel",
        p."step",
        p."contrato",
        p."plataforma",
        p."tipoUsuario",
        p."_createdDate",
        COUNT(ab."_id") as "totalSesiones",
        COUNT(ab."_id") FILTER (WHERE ab."asistio" = true) as "sesionesAsistidas"
      FROM "PEOPLE" p
      LEFT JOIN "ACADEMICA_BOOKINGS" ab ON p."_id" = ab."visitorId"
      LEFT JOIN "CALENDARIO" c ON ab."eventoId" = c."_id"
        AND c."dia" >= $1::timestamp with time zone
        AND c."dia" <= $2::timestamp with time zone
      WHERE p."tipoUsuario" = 'BENEFICIARIO'
      GROUP BY p."_id"
      ORDER BY p."primerApellido" ASC, p."primerNombre" ASC`,
      [fechaInicio, fechaFin]
    )

    console.log(`✅ [PostgreSQL] Informe generado: ${result.rowCount} beneficiarios`)

    // Transform to match expected format
    const beneficiarios = result.rows.map((row: any) => ({
      ...row,
      nombreCompleto: [row.primerNombre, row.segundoNombre, row.primerApellido, row.segundoApellido]
        .filter(Boolean)
        .join(' '),
      totalSesiones: parseInt(row.totalSesiones) || 0,
      sesionesAsistidas: parseInt(row.sesionesAsistidas) || 0
    }))

    return NextResponse.json({
      success: true,
      beneficiarios: beneficiarios,
      total: beneficiarios.length,
      source: 'postgres'
    })
  } catch (error) {
    console.error('❌ [PostgreSQL] Error en /api/informes/beneficiarios:', error)
    return NextResponse.json(
      {
        error: 'Error generando el informe',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
