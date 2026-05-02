import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/advisors/photo-presign
 *
 * Returns a presigned PUT URL so the advisor can upload their photo
 * directly to DO Spaces (fotosAdvisors/) without routing through the server.
 *
 * Body: { advisorId, contentType }
 */
export const POST = handlerWithAuth(async (request) => {
  const { advisorId, contentType } = await request.json();

  if (!advisorId) throw new ValidationError('advisorId es requerido');

  const ext = (contentType || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const key = `fotosAdvisors/${advisorId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    ContentType: contentType || 'image/jpeg',
    ACL: 'private',
  });

  const presignedUrl = await getSignedUrl(spacesClient, command, { expiresIn: 600 });

  return successResponse({ presignedUrl, key });
});
