import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { REGLAMENTO_KEY, getReglamentoPersonalizado } from '@/lib/reglamento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mantenimiento › Avisos › Reglamentos.
 *
 * Reemplaza el PDF del Reglamento de Participantes que ven los estudiantes, sin
 * desplegar. El archivo vive en Spaces; el del repo queda como respaldo (ver
 * [lib/reglamento.ts]).
 *
 *   GET    → qué se está sirviendo hoy (personalizado o el del repo) + metadatos
 *   POST   → sube un PDF nuevo (FormData: file)
 *   DELETE → borra el personalizado y vuelve al PDF del repo
 *
 * Gate: MANTENIMIENTO.AVISOS.REGLAMENTOS (SUPER_ADMIN / ADMIN hacen bypass).
 */

// 20 MB. El reglamento actual pesa 0,6 MB; el tope es para que un escaneo mal
// exportado no termine en Spaces ni tumbe el request.
const MAX_BYTES = 20 * 1024 * 1024;

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.AVISOS_REGLAMENTOS);

  const personalizado = await getReglamentoPersonalizado();
  return successResponse({
    personalizado: !!personalizado,
    size: personalizado?.size ?? null,
    lastModified: personalizado?.lastModified ?? null,
  });
});

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.AVISOS_REGLAMENTOS);

  const form = await req.formData();
  const file = form.get('file') as File | null;

  if (!file?.size) throw new ValidationError('Debe seleccionar un archivo');

  // Se valida por tipo Y por extensión: algunos navegadores mandan el tipo
  // vacío o genérico según cómo se haya elegido el archivo.
  const esPdf =
    /application\/pdf/i.test(file.type || '') || file.name.toLowerCase().endsWith('.pdf');
  if (!esPdf) throw new ValidationError('El reglamento debe ser un archivo PDF');

  if (file.size > MAX_BYTES) {
    throw new ValidationError(
      `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 20 MB`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Un PDF real empieza con "%PDF". Sin esta comprobación, un archivo
  // renombrado a .pdf se publicaría y el alumno vería un visor roto.
  if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new ValidationError('El archivo no es un PDF válido');
  }

  await spacesClient.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: REGLAMENTO_KEY,
      Body: buffer,
      ContentType: 'application/pdf',
      ACL: 'private',
      Metadata: {
        // Traza de quién publicó esta versión; el objeto no tiene historial.
        'subido-por': encodeURIComponent(session?.user?.email || 'desconocido'),
        'subido-en': new Date().toISOString(),
      },
    }),
  );

  console.log(
    `📄 [Mantenimiento] Reglamento actualizado (${(buffer.length / 1024).toFixed(0)} KB) ` +
    `por ${session?.user?.email || 'desconocido'}`,
  );

  return successResponse({ message: 'Reglamento publicado correctamente', size: buffer.length });
});

export const DELETE = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.AVISOS_REGLAMENTOS);

  await spacesClient.send(
    new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: REGLAMENTO_KEY }),
  );

  console.log(
    `📄 [Mantenimiento] Reglamento personalizado eliminado por ${session?.user?.email || 'desconocido'} ` +
    '— vuelve a servirse el PDF del repo',
  );

  return successResponse({ message: 'Se restauró el reglamento original' });
});
