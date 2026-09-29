import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne, queryMany } from '@/lib/postgres';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// POST — append a document to PEOPLE.documentacion (requiere permiso de subir)
export const POST = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.ADICION_DOCUMENTACION);
  const titularId = params.id;
  const { url, nombre, tipo } = await request.json();

  if (!url || !nombre) throw new ValidationError('url y nombre son requeridos');

  const titular = await queryOne(`SELECT "_id" FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  if (!titular) throw new NotFoundError('Titular', titularId);

  const doc = { url, nombre, tipo: tipo || 'application/octet-stream', fechaSubida: new Date().toISOString() };

  await queryOne(
    `UPDATE "PEOPLE"
     SET "documentacion" = COALESCE("documentacion", '[]'::jsonb) || $1::jsonb
     WHERE "_id" = $2`,
    [JSON.stringify([doc]), titularId]
  );

  // Return updated list
  const updated = await queryOne(`SELECT "documentacion" FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  return successResponse({ documentacion: updated?.documentacion || [] });
});

// DELETE — remove a document by URL from PEOPLE.documentacion and from Spaces
export const DELETE = handlerWithAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.ELIMINAR_DOCUMENTACION);
  const titularId = params.id;
  const { url } = await request.json();
  if (!url) throw new ValidationError('url requerida');

  const titular = await queryOne(
    `SELECT "documentacion" FROM "PEOPLE" WHERE "_id" = $1`,
    [titularId]
  );
  if (!titular) throw new NotFoundError('Titular', titularId);

  const docs: any[] = titular.documentacion || [];
  const filtered = docs.filter((d: any) => d.url !== url);

  await queryOne(
    `UPDATE "PEOPLE" SET "documentacion" = $1::jsonb WHERE "_id" = $2`,
    [JSON.stringify(filtered), titularId]
  );

  // Delete from Spaces — extract key from URL
  try {
    const urlObj = new URL(url);
    const key = urlObj.pathname.replace(/^\//, '');
    await spacesClient.send(new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: key }));
  } catch { /* ignore Spaces delete errors — DB is source of truth */ }

  return successResponse({ documentacion: filtered });
});

// GET — fetch current documentacion list (solo requiere sesión; se usa en varios
// contextos con distintos permisos de página, así que no se gatea por permiso fino)
export const GET = handlerWithAuth(async (_request, { params }) => {
  const titularId = params.id;
  const row = await queryOne(`SELECT "documentacion" FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  if (!row) throw new NotFoundError('Titular', titularId);
  return successResponse({ documentacion: row.documentacion || [] });
});
