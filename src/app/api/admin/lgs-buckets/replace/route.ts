/**
 * API: /api/admin/lgs-buckets/replace  (POST, multipart)
 *
 * Reemplaza la foto de un advisor o usuario:
 *   - Sube la nueva imagen a DO Spaces (key nueva con timestamp).
 *   - Actualiza ADVISORS.fotoAdvisor (key) o ACADEMICA.foto (URL pública).
 *   - Borra el objeto anterior en Spaces (best-effort, si era de Spaces).
 *
 * Campos form-data: tipo ('advisor'|'usuario'), id, file.
 * Gated por MANTENIMIENTO.LGS_BUCKETS.EDITAR (SUPER_ADMIN/ADMIN bypass).
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { spacesClient, SPACES_BUCKET, SPACES_CDN, getPresignedVideoUrl } from '@/lib/spaces';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX = 10 * 1024 * 1024;

function keyFromStored(stored: string | null): string | null {
  const s = (stored || '').trim();
  if (!s || s.startsWith('wix:')) return null;
  const m = s.match(/digitaloceanspaces\.com\/(.+)$/i);
  if (m) return decodeURIComponent(m[1]);
  if (/^https?:\/\//i.test(s)) return null;
  return s;
}

export const POST = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LGS_BUCKETS_EDITAR);

  const form = await req.formData();
  const tipo = String(form.get('tipo') || '');
  const id = String(form.get('id') || '');
  const file = form.get('file') as File | null;

  if (tipo !== 'advisor' && tipo !== 'usuario') throw new ValidationError('tipo inválido (advisor|usuario)');
  if (!id) throw new ValidationError('id requerido');
  if (!file) throw new ValidationError('Archivo requerido');
  if (!ALLOWED.includes(file.type)) throw new ValidationError(`Tipo no permitido: ${file.type}. Use JPG, PNG, WEBP o HEIC.`);
  if (file.size > MAX) throw new ValidationError('La imagen excede el máximo de 10MB');

  const table = tipo === 'advisor' ? 'ADVISORS' : 'ACADEMICA';
  const col = tipo === 'advisor' ? 'fotoAdvisor' : 'foto';

  // Verifica que exista + lee el valor anterior (para borrar el objeto viejo)
  const existing = await queryOne<any>(
    `SELECT "_id", "${col}" AS prev FROM "${table}" WHERE "_id" = $1`, [id]
  );
  if (!existing) throw new NotFoundError(table, id);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const ts = Date.now();
  const key = tipo === 'advisor'
    ? `fotosAdvisors/${id}_${ts}.${ext}`
    : `fotos/${id}/foto-${ts}.${ext}`;
  // advisor: privado (igual que el flujo de /nuevo-advisor)
  // usuario: público (igual que el flujo de /nuevo-usuario)
  const acl = tipo === 'advisor' ? 'private' : 'public-read';

  const buffer = Buffer.from(await file.arrayBuffer());
  await spacesClient.send(new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    ACL: acl as any,
  }));

  // Valor a guardar en BD: advisor=key, usuario=URL pública (igual que el dato existente)
  const stored = tipo === 'advisor' ? key : `${SPACES_CDN}/${key}`;
  await queryOne(
    `UPDATE "${table}" SET "${col}" = $2, "_updatedDate" = NOW() WHERE "_id" = $1 RETURNING "_id"`,
    [id, stored]
  );

  // Borra el objeto anterior (best-effort; solo si era de Spaces y distinto)
  const prevKey = keyFromStored(existing.prev);
  if (prevKey && prevKey !== key) {
    try {
      await spacesClient.send(new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: prevKey }));
    } catch { /* no-op: huérfano inofensivo */ }
  }

  // URL para refrescar la card: presigned (advisor) o pública (usuario)
  const url = tipo === 'advisor' ? await getPresignedVideoUrl(key, 3600) : `${SPACES_CDN}/${key}`;
  return successResponse({ ok: true, url, filename: key.split('/').pop() });
});
