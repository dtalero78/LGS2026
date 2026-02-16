/**
 * Progress Service
 *
 * Business logic for the "¿Cómo voy?" student progress report.
 * Calculates step completion, attendance stats, and class breakdown.
 *
 * Step completion rules:
 *   1. Normal Steps (1-4, 6-9, 11-14, etc.):
 *      - 2 sesiones exitosas (tipo SESSION, asistio/asistencia/participacion = true)
 *      - 1 TRAINING club exitoso (tipo CLUB, asistio/asistencia/participacion = true)
 *   2. Jump Steps (5, 10, 15, 20, 25, 30, 35, 40, 45):
 *      - 1 clase registrada en ese step
 *      - noAprobo !== true
 *   3. Overrides manuales tienen prioridad absoluta sobre toda la lógica.
 */

import 'server-only';
import { queryMany } from '@/lib/postgres';
import { PeopleRepository } from '@/repositories/people.repository';
import { AcademicaRepository } from '@/repositories/academica.repository';
import { StepOverridesRepository } from '@/repositories/niveles.repository';
import { NotFoundError } from '@/lib/errors';

// --- Helpers ---

/** Extract the numeric part from a step name: "Step 7" → 7, "TRAINING - Step 7" → 7 */
function extractStepNumber(stepName: string): number | null {
  const match = stepName.match(/Step\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

/** Jump Steps are multiples of 5: Step 5, 10, 15, 20, 25, 30, 35, 40, 45 */
function isJumpStep(stepName: string): boolean {
  const num = extractStepNumber(stepName);
  return num !== null && num > 0 && num % 5 === 0;
}

/** A class counts as "exitosa" if student attended or participated */
function isExitosa(c: any): boolean {
  return c.asistio === true || c.asistencia === true || c.participacion === true;
}

/**
 * Determine the effective class type.
 * The `tipo` column is null in migrated Wix data, so we infer from the step name:
 *   - "Step N"            → SESSION
 *   - "TRAINING - Step N" → CLUB
 *   - Other prefixes      → OTHER (not counted toward step requirements)
 * When `tipo` is populated (e.g. events created via admin panel), use it directly.
 */
function getClassType(c: any): 'SESSION' | 'CLUB' | 'OTHER' {
  if (c.tipo === 'SESSION') return 'SESSION';
  if (c.tipo === 'CLUB') return 'CLUB';
  if (c.tipo === 'WELCOME') return 'OTHER';
  // Infer from step name when tipo is null
  if (!c.tipo && c.step) {
    if (/^TRAINING\s*-/i.test(c.step)) return 'CLUB';
    if (/^Step\s+\d+$/i.test(c.step)) return 'SESSION';
  }
  return 'OTHER';
}

// --- Main ---

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
  const allSteps = stepsRows
    .map((r) => r.step)
    .sort((a, b) => (extractStepNumber(a) ?? 0) - (extractStepNumber(b) ?? 0));

  // Get all overrides for this student at once (avoid N+1)
  const overrides = await StepOverridesRepository.findByStudentId(student._id);
  const overrideMap = new Map(
    overrides.map((o: any) => [o.step, o.completado])
  );

  // Calculate progress by step
  const progressByStep = allSteps.map((stepName) => {
    const stepNum = extractStepNumber(stepName);
    const esJump = isJumpStep(stepName);

    // Match classes by step number to handle both "Step 7" and "TRAINING - Step 7"
    const clasesDelStep = clasesNivelActual.filter(
      (c) => extractStepNumber(c.step) === stepNum
    );

    // Separate by type (infer from step name when tipo is null)
    const sesiones = clasesDelStep.filter((c) => getClassType(c) === 'SESSION');
    const clubs = clasesDelStep.filter((c) => getClassType(c) === 'CLUB');
    const sesionesExitosas = sesiones.filter(isExitosa).length;
    const clubsExitosos = clubs.filter(isExitosa).length;
    const tieneNoAprobo = clasesDelStep.some((c) => c.noAprobo === true);

    // Override has absolute priority
    const hasOverride = overrideMap.has(stepName);
    const overrideCompletado = hasOverride ? overrideMap.get(stepName) : null;

    let completado: boolean;
    let mensaje: string | null = null;

    if (overrideCompletado === true) {
      completado = true;
    } else if (overrideCompletado === false) {
      completado = false;
      mensaje = 'Marcado como incompleto por administrador';
    } else if (esJump) {
      // Jump Step: 1 class registered + noAprobo !== true
      if (tieneNoAprobo) {
        completado = false;
        mensaje = 'No aprobó el jump';
      } else if (clasesDelStep.length === 0) {
        completado = false;
        mensaje = 'Falta la clase del jump';
      } else {
        completado = true;
      }
    } else {
      // Normal Step: 2 sesiones exitosas + 1 club exitoso
      completado = sesionesExitosas >= 2 && clubsExitosos >= 1;

      if (!completado) {
        if (sesionesExitosas >= 2 && clubsExitosos === 0) {
          mensaje = 'Falta un TRAINING SESSION';
        } else if (sesionesExitosas === 1 && clubsExitosos === 0) {
          mensaje = 'Falta una sesión (¿quieres realizar la actividad...)';
        } else if (sesionesExitosas === 1 && clubsExitosos >= 1) {
          mensaje = 'Falta una sesión para terminar. Realiza la prueba escrita...';
        } else if (sesionesExitosas === 0 && clubsExitosos >= 1) {
          mensaje = 'Faltan dos sesiones';
        } else {
          mensaje = 'Faltan dos sesiones y un TRAINING SESSION';
        }
      }
    }

    return {
      step: stepName,
      esJump,
      totalClases: clasesDelStep.length,
      sesiones: sesiones.length,
      sesionesExitosas,
      clubs: clubs.length,
      clubsExitosos,
      noAprobo: tieneNoAprobo,
      completado,
      mensaje,
      hasOverride,
      overrideCompletado,
    };
  });

  // Overall statistics (across ALL classes including ESS)
  const totalClases = allClasses.length;
  const totalAsistencias = allClasses.filter((c) => isExitosa(c)).length;
  const totalAusencias = allClasses.filter((c) => c.asistio === false).length;
  const totalPendientes = allClasses.filter((c) => c.asistio === null || c.asistio === undefined).length;
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
    if (isExitosa(c)) byTipoMap[c.tipo].asistencias++;
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
