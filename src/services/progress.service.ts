/**
 * Progress Service
 *
 * Business logic for the "¿Cómo voy?" student progress report.
 * Calculates step completion, attendance stats, and class breakdown.
 */

import 'server-only';
import { queryMany } from '@/lib/postgres';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { StepOverridesRepository } from '@/repositories/niveles.repository';
import { NotFoundError } from '@/lib/errors';

/**
 * Generate the full progress report for a student.
 */
export async function generateReport(studentId: string) {
  // Get student info (try PEOPLE first, fallback to ACADEMICA)
  let student: any = await PeopleRepository.findByIdOrNumeroId(studentId);
  if (!student) {
    student = await AcademicaRepository.findByAnyId(studentId);
  }
  if (!student) throw new NotFoundError('Student', studentId);

  const nivelPrincipal = student.nivel;

  // Get all classes for this student
  const allClasses = await queryMany(
    `SELECT "_id", "eventoId", "nivel", "step", "advisor", "fechaEvento", "hora",
            "tipo", "nombreEvento", "asistio", "asistencia", "participacion",
            "calificacion", "comentarios", "noAprobo"
     FROM "ACADEMICA_BOOKINGS"
     WHERE ("idEstudiante" = $1 OR "studentId" = $1)
     ORDER BY "fechaEvento" DESC`,
    [student._id]
  );

  // Filter classes for current nivel (exclude ESS and WELCOME from step progress)
  const clasesNivelActual = allClasses.filter(
    (c) => c.nivel === nivelPrincipal && c.step !== 'WELCOME' && c.nivel !== 'ESS'
  );

  // Get all steps for current nivel
  const stepsRows = await queryMany<{ step: string }>(
    `SELECT DISTINCT "step"
     FROM "NIVELES"
     WHERE "code" = $1 AND "step" != 'WELCOME'
     ORDER BY "step"`,
    [nivelPrincipal]
  );
  const allSteps = stepsRows.map((r) => r.step);

  // Get all overrides for this student at once (avoid N+1)
  const overrides = await StepOverridesRepository.findByStudentId(student._id);
  const overrideMap = new Map(
    overrides.map((o: any) => [o.step, o.completado])
  );

  // Calculate progress by step
  const progressByStep = allSteps.map((stepName) => {
    const clasesDelStep = clasesNivelActual.filter((c) => c.step === stepName);
    const asistencias = clasesDelStep.filter((c) => c.asistio === true).length;
    const noAprobo = clasesDelStep.filter((c) => c.noAprobo === true).length;

    const hasOverride = overrideMap.has(stepName);
    const overrideCompletado = hasOverride ? overrideMap.get(stepName) : null;

    // Step is complete if override says so OR 5+ attended classes
    const completado = overrideCompletado === true || asistencias >= 5;

    return {
      step: stepName,
      totalClases: clasesDelStep.length,
      asistencias,
      noAprobo,
      completado,
      hasOverride,
      overrideCompletado,
    };
  });

  // Overall statistics (across ALL classes including ESS)
  const totalClases = allClasses.length;
  const totalAsistencias = allClasses.filter((c) => c.asistio === true).length;
  const totalAusencias = allClasses.filter((c) => c.asistio === false).length;
  const totalPendientes = allClasses.filter((c) => c.asistio === null).length;
  const porcentajeAsistencia =
    totalClases > 0 ? Math.round((totalAsistencias / totalClases) * 100) : 0;

  const stepsCompletados = progressByStep.filter((s) => s.completado).length;
  const porcentajeProgreso =
    allSteps.length > 0 ? Math.round((stepsCompletados / allSteps.length) * 100) : 0;

  // Group classes by tipo
  const byTipoMap: Record<string, { tipo: string; totalClases: number; asistencias: number }> = {};
  for (const c of allClasses) {
    if (!c.tipo) continue;
    if (!byTipoMap[c.tipo]) {
      byTipoMap[c.tipo] = { tipo: c.tipo, totalClases: 0, asistencias: 0 };
    }
    byTipoMap[c.tipo].totalClases++;
    if (c.asistio === true) byTipoMap[c.tipo].asistencias++;
  }

  return {
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
    byTipo: Object.values(byTipoMap),
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
      calificacion: c.calificacion,
      comentarios: c.comentarios,
      noAprobo: c.noAprobo,
    })),
  };
}
