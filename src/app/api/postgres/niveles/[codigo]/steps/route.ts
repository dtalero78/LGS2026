import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { PeopleRepository } from '@/repositories/people.repository';
import { StepOverridesRepository } from '@/repositories/niveles.repository';
import { NotFoundError } from '@/lib/errors';
import { queryMany } from '@/lib/postgres';

/**
 * GET /api/postgres/niveles/[codigo]/steps
 */
export const GET = handlerWithAuth(async (request, { params }) => {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const nivelCodigo = decodeURIComponent(params.codigo);

  const nivelRecords = await NivelesRepository.getStepsForNivel(nivelCodigo);
  if (nivelRecords.length === 0) throw new NotFoundError('Nivel', nivelCodigo);

  const isParallel = nivelRecords[0]?.esParalelo === true;

  const allSteps: any[] = [];
  const seenSteps = new Set<string>();
  for (const record of nivelRecords) {
    if (!seenSteps.has(record.step)) {
      seenSteps.add(record.step);
      allSteps.push({ step: record.step, stepNumber: record.step.replace('Step ', ''), description: record.description || '' });
    }
  }

  let studentProgress: any = null;
  if (studentId) {
    const student = await PeopleRepository.findByIdOrNumeroId(studentId);
    if (student) {
      const overridesRaw = await StepOverridesRepository.findByStudentAndNivel(student._id, nivelCodigo);
      const overrides = overridesRaw.reduce((acc: any, row: any) => {
        acc[row.step] = { completado: row.isCompleted };
        return acc;
      }, {});

      const classesRaw = await queryMany(
        `SELECT DISTINCT "step", COUNT(*) as "totalClases"
         FROM "ACADEMICA_BOOKINGS"
         WHERE ("idEstudiante" = $1 OR "studentId" = $1) AND "nivel" = $2 AND "asistio" = true
         GROUP BY "step"`,
        [student._id, nivelCodigo]
      );
      const classesByStep = classesRaw.reduce((acc: any, row: any) => {
        acc[row.step] = parseInt(row.totalClases) || 0;
        return acc;
      }, {});

      let currentStep;
      if (isParallel) {
        currentStep = student.nivelParalelo === nivelCodigo ? student.stepParalelo : null;
      } else {
        currentStep = student.nivel === nivelCodigo ? student.step : null;
      }

      studentProgress = { currentStep, overrides, classesByStep };
    }
  }

  const stepsWithProgress = allSteps.map((step) => {
    const stepData: any = { ...step };
    if (studentProgress) {
      stepData.isCurrentStep = studentProgress.currentStep === step.step;
      stepData.override = studentProgress.overrides[step.step] || null;
      stepData.totalClases = studentProgress.classesByStep[step.step] || 0;
    }
    return stepData;
  });

  return successResponse({
    nivel: nivelCodigo,
    esParalelo: isParallel,
    totalSteps: allSteps.length,
    steps: stepsWithProgress,
    studentProgress: studentProgress ? {
      currentStep: studentProgress.currentStep,
      hasOverrides: Object.keys(studentProgress.overrides).length > 0,
    } : null,
  });
});
