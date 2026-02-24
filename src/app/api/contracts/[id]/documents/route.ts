import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queryOne, queryMany } from '@/lib/postgres';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// POST — append a document to PEOPLE.documentacion
export const POST = handler(async (request, { params }) => {
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
export const DELETE = handler(async (request, { params }) => {
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

// GET — fetch current documentacion list
export const GET = handler(async (_request, { params }) => {
  const titularId = params.id;
  const row = await queryOne(`SELECT "documentacion" FROM "PEOPLE" WHERE "_id" = $1`, [titularId]);
  if (!row) throw new NotFoundError('Titular', titularId);
  return successResponse({ documentacion: row.documentacion || [] });
});
