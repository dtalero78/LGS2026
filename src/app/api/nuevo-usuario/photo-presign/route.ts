import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/nuevo-usuario/photo-presign
 *
 * Public presigned PUT URL for student photo during registration.
 * No auth required — /nuevo-usuario is a public page.
 * Key: fotos/{academicaId}/foto-{timestamp}.{ext}
 *
 * Body: { academicaId, contentType }
 */
export const POST = handler(async (request) => {
  const { academicaId, contentType } = await request.json();

  if (!academicaId?.trim()) throw new ValidationError('academicaId es requerido');

  const ext = (contentType || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const key = `fotos/${academicaId.trim()}/foto-${Date.now()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    ContentType: contentType || 'image/jpeg',
    ACL: 'public-read',
  });

  const presignedUrl = await getSignedUrl(spacesClient, command, { expiresIn: 600 });

  // Public URL for display (after upload)
  const publicUrl = `https://${SPACES_BUCKET}.sfo3.digitaloceanspaces.com/${key}`;

  return successResponse({ presignedUrl, key, publicUrl });
});
