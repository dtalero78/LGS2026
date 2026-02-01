/**
 * API Route: /api/wix-proxy/student-progress
 * Obtiene el diagnóstico académico "¿Cómo voy?" del estudiante
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

/**
 * GET /api/wix-proxy/student-progress?id=studentId
 * Obtiene el diagnóstico académico del estudiante
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const studentId = searchParams.get('id')

    if (!studentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de estudiante requerido'
        },
        { status: 400 }
      )
    }

    console.log(`📊 [PostgreSQL] Obteniendo diagnóstico académico para estudiante: ${studentId}`)

    // Get student info
    const studentResult = await query(
      `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
      [studentId]
    )

    if (studentResult.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Estudiante no encontrado'
      }, { status: 404 })
    }

    const student = studentResult.rows[0]
    const nivelPrincipal = student.nivel

    // Get all classes for the student
    const classesResult = await query(
      `SELECT
        ab.*,
        c."dia",
        c."hora",
        c."tipo",
        c."nivel" as "eventoNivel",
        c."step" as "eventoStep",
        c."descripcion"
      FROM "ACADEMICA_BOOKINGS" ab
      LEFT JOIN "CALENDARIO" c ON ab."eventoId" = c."_id"
      WHERE ab."visitorId" = $1
      ORDER BY c."dia" DESC`,
      [studentId]
    )

    const classes = classesResult.rows

    // Filter classes for current level (excluding ESS and WELCOME)
    const clasesNivelActual = classes.filter((c: any) =>
      c.eventoNivel === nivelPrincipal &&
      c.eventoStep !== 'WELCOME' &&
      c.eventoNivel !== 'ESS'
    )

    // Get level steps info
    const nivelesResult = await query(
      `SELECT DISTINCT "step" FROM "NIVELES" WHERE "code" = $1 ORDER BY "step"`,
      [nivelPrincipal]
    )

    const stepsDelNivel = nivelesResult.rows.map((r: any) => r.step)

    // Calculate stats per step
    const statsPorStep: Record<string, any> = {}

    stepsDelNivel.forEach((step: string) => {
      const clasesStep = clasesNivelActual.filter((c: any) => c.eventoStep === step)
      const sesiones = clasesStep.filter((c: any) => c.tipo === 'SESSION')
      const clubs = clasesStep.filter((c: any) => c.tipo === 'CLUB')

      const sesionesAsistidas = sesiones.filter((s: any) => s.asistio === true).length
      const sesionesTotal = sesiones.length
      const clubsAsistidos = clubs.filter((c: any) => c.asistio === true).length
      const clubsTotal = clubs.length

      // Calculate participation averages
      const participaciones = clasesStep
        .filter((c: any) => c.participacion != null && c.asistio === true)
        .map((c: any) => parseFloat(c.participacion) || 0)

      const promedioParticipacion = participaciones.length > 0
        ? participaciones.reduce((a: number, b: number) => a + b, 0) / participaciones.length
        : 0

      statsPorStep[step] = {
        step,
        sesiones: {
          asistidas: sesionesAsistidas,
          total: sesionesTotal,
          porcentaje: sesionesTotal > 0 ? Math.round((sesionesAsistidas / sesionesTotal) * 100) : 0
        },
        clubs: {
          asistidos: clubsAsistidos,
          total: clubsTotal,
          porcentaje: clubsTotal > 0 ? Math.round((clubsAsistidos / clubsTotal) * 100) : 0
        },
        participacion: {
          promedio: Math.round(promedioParticipacion * 10) / 10,
          evaluaciones: participaciones.length
        },
        completado: sesionesAsistidas >= 4 && clubsAsistidos >= 3
      }
    })

    // Calculate overall stats
    const totalSesionesAsistidas = clasesNivelActual.filter((c: any) =>
      c.tipo === 'SESSION' && c.asistio === true
    ).length

    const totalSesiones = clasesNivelActual.filter((c: any) => c.tipo === 'SESSION').length

    const totalClubsAsistidos = clasesNivelActual.filter((c: any) =>
      c.tipo === 'CLUB' && c.asistio === true
    ).length

    const totalClubs = clasesNivelActual.filter((c: any) => c.tipo === 'CLUB').length

    const allParticipaciones = clasesNivelActual
      .filter((c: any) => c.participacion != null && c.asistio === true)
      .map((c: any) => parseFloat(c.participacion) || 0)

    const promedioGeneral = allParticipaciones.length > 0
      ? allParticipaciones.reduce((a: number, b: number) => a + b, 0) / allParticipaciones.length
      : 0

    // Determine step actual progress
    const stepActual = student.step || 'Step 1'
    const stepsCompletados = Object.values(statsPorStep).filter((s: any) => s.completado).length

    const diagnostico = {
      success: true,
      estudiante: {
        _id: student._id,
        nombre: `${student.primerNombre} ${student.primerApellido}`,
        nivel: nivelPrincipal,
        step: stepActual,
        nivelParalelo: student.nivelParalelo || null,
        stepParalelo: student.stepParalelo || null
      },
      resumen: {
        nivel: nivelPrincipal,
        stepActual,
        stepsCompletados,
        totalSteps: stepsDelNivel.length,
        progreso: stepsDelNivel.length > 0
          ? Math.round((stepsCompletados / stepsDelNivel.length) * 100)
          : 0
      },
      estadisticasGenerales: {
        sesiones: {
          asistidas: totalSesionesAsistidas,
          total: totalSesiones,
          porcentaje: totalSesiones > 0 ? Math.round((totalSesionesAsistidas / totalSesiones) * 100) : 0
        },
        clubs: {
          asistidos: totalClubsAsistidos,
          total: totalClubs,
          porcentaje: totalClubs > 0 ? Math.round((totalClubsAsistidos / totalClubs) * 100) : 0
        },
        participacion: {
          promedio: Math.round(promedioGeneral * 10) / 10,
          evaluaciones: allParticipaciones.length
        }
      },
      porStep: statsPorStep,
      todasLasClases: classes.map((c: any) => ({
        _id: c._id,
        fecha: c.dia,
        hora: c.hora,
        tipo: c.tipo,
        nivel: c.eventoNivel,
        step: c.eventoStep,
        asistio: c.asistio || false,
        participacion: c.participacion,
        calificacion: c.calificacion,
        descripcion: c.descripcion
      }))
    }

    console.log(`✅ [PostgreSQL] Diagnóstico generado para ${student.primerNombre}`)

    return NextResponse.json(diagnostico, { status: 200 })

  } catch (error) {
    console.error('❌ [PostgreSQL] Error en student-progress:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo diagnóstico académico',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
