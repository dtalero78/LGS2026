import { handler, successResponse } from '@/lib/api-helpers';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/niveles/[codigo]
 */
export const GET = handler(async (request: Request, { params }: any) => {
  const { codigo } = params;
  if (!codigo) throw new ValidationError('Level code is required');

  const steps = await NivelesRepository.findByCode(codigo);
  if (steps.length === 0) throw new NotFoundError('Level', codigo);

  return successResponse({
    data: {
      nivel: codigo,
      esParalelo: steps[0].esParalelo,
      totalSteps: steps.length,
      steps,
    },
  });
});
