import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { spacesClient, SPACES_BUCKET, SPACES_CDN } from '@/lib/spaces';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/nuevo-usuario/[id]/upload-photo
 *
 * Public endpoint. Upload student photo to DO Spaces.
 * Returns the public URL of the uploaded photo.
 */
export const POST = handler(async (
  request: Request,
  { params }: { params: Record<string, string> }
) => {
  const academicId = params.id;

  // Verify student exists
  const student = await queryOne(
    `SELECT "_id" FROM "ACADEMICA" WHERE "_id" = $1`,
    [academicId]
  );
  if (!student) throw new NotFoundError('Registro académico', academicId);

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) throw new ValidationError('No se proporcionó archivo');
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError(`Tipo de archivo no permitido: ${file.type}. Usa JPG, PNG o WEBP.`);
  }
  if (file.size > MAX_SIZE) {
    throw new ValidationError('El archivo excede el tamaño máximo de 10MB');
  }

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate unique key
  const ext = file.name.split('.').pop() || 'jpg';
  const key = `fotos/${academicId}/foto-${Date.now()}.${ext}`;

  // Upload to DO Spaces
  await spacesClient.send(new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    ACL: 'public-read',
  }));

  const publicUrl = `${SPACES_CDN}/${key}`;
  console.log(`✅ [NuevoUsuario] Foto subida: ${publicUrl}`);

  return successResponse({ publicUrl, key });
});
