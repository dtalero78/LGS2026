import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/students/[id]/progress
 *
 * Get student progress report ("¿Cómo voy?")
 *
 * This endpoint generates a comprehensive academic progress report including:
 * - Student info
 * - Progress by steps (classes attended per step)
 * - Overall statistics
 * - All classes history
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get student info
    const studentResult = await query(
      `SELECT
        "_id",
        "numeroId",
        "primerNombre",
        "primerApellido",
        "nivel",
        "step",
        "nivelParalelo",
        "stepParalelo",
        "plataforma",
        "email"
      FROM "PEOPLE"
      WHERE "_id" = $1 OR "numeroId" = $1`,
      [params.id]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];
    const nivelPrincipal = student.nivel;

    // Get all classes for the student
    const classesResult = await query(
      `SELECT
        "_id",
        "eventoId",
        "nivel",
        "step",
        "advisor",
        "fechaEvento",
        "hora",
        "tipo",
        "nombreEvento",
        "asistio",
        "asistencia",
        "participacion",
        "evaluacion",
        "comentarios",
        "noAprobo"
      FROM "ACADEMICA_BOOKINGS"
      WHERE ("idEstudiante" = $1 OR "studentId" = $1)
      ORDER BY "fechaEvento" DESC`,
      [student._id]
    );

    const allClasses = classesResult.rows;

    // Filter classes for current nivel (exclude ESS from step progress)
    const clasesNivelActual = allClasses.filter(
      (c) => c.nivel === nivelPrincipal && c.step !== 'WELCOME' && c.nivel !== 'ESS'
    );

    // Get all steps for current nivel
    const stepsResult = await query(
      `SELECT DISTINCT "step"
       FROM "NIVELES"
       WHERE "code" = $1 AND "step" != 'WELCOME'
       ORDER BY "step"`,
      [nivelPrincipal]
    );

    const allSteps = stepsResult.rows.map((r) => r.step);

    // Calculate progress by step
    const progressByStep: any[] = [];

    for (const stepName of allSteps) {
      const clasesDelStep = clasesNivelActual.filter((c) => c.step === stepName);
      const asistencias = clasesDelStep.filter((c) => c.asistio === true).length;
      const noAprobo = clasesDelStep.filter((c) => c.noAprobo === true).length;

      // Check if student has override for this step
      const overrideResult = await query(
        `SELECT "completado" FROM "STEP_OVERRIDES"
         WHERE "studentId" = $1 AND "step" = $2`,
        [student._id, stepName]
      );

      const hasOverride = overrideResult.rowCount > 0;
      const overrideCompletado = hasOverride ? overrideResult.rows[0].completado : null;

      // Step is complete if:
      // 1. Has override marked as completed, OR
      // 2. Has at least 5 classes with asistio=true (standard rule)
      const completado = overrideCompletado === true || asistencias >= 5;

      progressByStep.push({
        step: stepName,
        totalClases: clasesDelStep.length,
        asistencias,
        noAprobo,
        completado,
        hasOverride,
        overrideCompletado,
      });
    }

    // Calculate overall statistics
    const totalClases = allClasses.length;
    const totalAsistencias = allClasses.filter((c) => c.asistio === true).length;
    const totalAusencias = allClasses.filter((c) => c.asistio === false).length;
    const totalPendientes = allClasses.filter((c) => c.asistio === null).length;
    const porcentajeAsistencia =
      totalClases > 0 ? Math.round((totalAsistencias / totalClases) * 100) : 0;

    // Count completed steps
    const stepsCompletados = progressByStep.filter((s) => s.completado).length;
    const porcentajeProgreso =
      allSteps.length > 0 ? Math.round((stepsCompletados / allSteps.length) * 100) : 0;

    // Group classes by tipo
    const byTipo: { [key: string]: any } = {};
    allClasses.forEach((c) => {
      if (!c.tipo) return;
      if (!byTipo[c.tipo]) {
        byTipo[c.tipo] = {
          tipo: c.tipo,
          totalClases: 0,
          asistencias: 0,
        };
      }
      byTipo[c.tipo].totalClases++;
      if (c.asistio === true) byTipo[c.tipo].asistencias++;
    });

    return NextResponse.json({
      success: true,
      student: {
        _id: student._id,
        numeroId: student.numeroId,
        nombre: `${student.primerNombre} ${student.primerApellido}`,
        nivel: student.nivel,
        step: student.step,
        nivelParalelo: student.nivelParalelo,
        stepParalelo: student.stepParalelo,
        plataforma: student.plataforma,
        email: student.email,
      },
      progress: {
        nivelActual: nivelPrincipal,
        totalSteps: allSteps.length,
        stepsCompletados,
        porcentajeProgreso,
        progressByStep,
      },
      stats: {
        totalClases,
        totalAsistencias,
        totalAusencias,
        totalPendientes,
        porcentajeAsistencia,
      },
      byTipo: Object.values(byTipo),
      allClasses: allClasses.map((c) => ({
        _id: c._id,
        nivel: c.nivel,
        step: c.step,
        tipo: c.tipo,
        nombreEvento: c.nombreEvento,
        advisor: c.advisor,
        fechaEvento: c.fechaEvento,
        hora: c.hora,
        asistio: c.asistio,
        asistencia: c.asistencia,
        participacion: c.participacion,
        evaluacion: c.evaluacion,
        comentarios: c.comentarios,
        noAprobo: c.noAprobo,
      })),
    });
  } catch (error: any) {
    console.error('❌ Error generating student progress:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
