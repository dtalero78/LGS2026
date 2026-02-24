import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { spacesClient, SPACES_BUCKET, SPACES_CDN } from '@/lib/spaces';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
];
const MAX_SIZE_MB = 20;

export const GET = handler(async (request, { params }) => {
  const titularId = params.id;
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename') || '';
  const contentType = searchParams.get('type') || '';

  if (!filename) throw new ValidationError('filename requerido');
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new ValidationError(`Tipo no permitido: ${contentType}. Use JPG, PNG, WEBP, HEIC o PDF.`);
  }

  // Build a unique key: contratos/{titularId}/{timestamp}-{filename}
  const ext = filename.split('.').pop() || 'bin';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `contratos/${titularId}/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: undefined,
    ACL: 'public-read',
  });

  const presignedUrl = await getSignedUrl(spacesClient, command, { expiresIn: 300 }); // 5 min
  const publicUrl = `${SPACES_CDN}/${key}`;

  return successResponse({ presignedUrl, publicUrl, key, maxSizeMb: MAX_SIZE_MB });
});
