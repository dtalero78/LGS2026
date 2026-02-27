import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { NivelesRepository } from '@/repositories/niveles.repository';
import { getPresignedVideoUrl } from '@/lib/spaces';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * GET /api/postgres/niveles/video?nivel=BN1&step=Step%201
 *
 * Returns a presigned URL for the video associated with a nivel+step.
 * Requires authentication.
 */
export const GET = handlerWithAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get('nivel');
  const step = searchParams.get('step');

  if (!nivel || !step) throw new ValidationError('nivel and step are required');

  const row = await NivelesRepository.findVideoByNivelAndStep(nivel, step);
  if (!row) throw new NotFoundError('Nivel/Step', `${nivel} ${step}`);
  if (!row.videoUrl) {
    return successResponse({ data: { videoUrl: null } });
  }

  const presignedUrl = await getPresignedVideoUrl(row.videoUrl);
  return successResponse({ data: { videoUrl: presignedUrl } });
});
