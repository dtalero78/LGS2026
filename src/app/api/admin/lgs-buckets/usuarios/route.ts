/**
 * API: /api/admin/lgs-buckets/usuarios?search=&page=&pageSize=  (GET)
 *
 * Lista las fotos de usuarios/estudiantes almacenadas en DO Spaces
 * (ACADEMICA.foto), paginadas y buscables, con presigned URL por foto.
 * Sólo lectura. Gated por MANTENIMIENTO.LGS_BUCKETS.VER.
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { queryOne, queryMany } from '@/lib/postgres';
import { getPresignedVideoUrl } from '@/lib/spaces';

function keyFromStored(stored: string | null): string | null {
  const s = (stored || '').trim();
  if (!s || s.startsWith('wix:')) return null;
  const m = s.match(/digitaloceanspaces\.com\/(.+)$/i);
  if (m) return decodeURIComponent(m[1]);
  if (/^https?:\/\//i.test(s)) return null;
  return s;
}

async function resolveUrl(stored: string | null): Promise<string | null> {
  const s = (stored || '').trim();
  if (!s || s.startsWith('wix:')) return null;
  if (/^https?:\/\//i.test(s) && !/digitaloceanspaces\.com/i.test(s)) return s;
  const key = keyFromStored(s);
  if (!key) return null;
  try { return await getPresignedVideoUrl(key, 3600); } catch { return null; }
}

export const GET = handlerWithAuth(async (req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LGS_BUCKETS);

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(60, Math.max(1, parseInt(searchParams.get('pageSize') || '24', 10) || 24));
  const offset = (page - 1) * pageSize;

  // Solo fotos que viven en nuestro Spaces (las legacy `wix:image://...` no son
  // accesibles desde nuestro bucket, así que se excluyen del visor).
  const conds: string[] = [
    `"foto" IS NOT NULL`,
    `TRIM("foto") <> ''`,
    `("foto" LIKE '%digitaloceanspaces.com%' OR "foto" LIKE 'fotos/%')`,
  ];
  const params: any[] = [];
  let i = 1;
  if (search) {
    conds.push(`("primerNombre" ILIKE $${i} OR "primerApellido" ILIKE $${i} OR "numeroId" ILIKE $${i} OR "email" ILIKE $${i})`);
    params.push(`%${search}%`); i++;
  }
  const where = `WHERE ${conds.join(' AND ')}`;

  const totalRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM "ACADEMICA" ${where}`, params
  );
  const total = parseInt(totalRow?.total ?? '0', 10) || 0;

  const rows = await queryMany<any>(
    `SELECT "_id", "primerNombre", "primerApellido", "numeroId", "email", "foto", "nivel", "step"
     FROM "ACADEMICA" ${where}
     ORDER BY "primerApellido" NULLS LAST, "primerNombre" NULLS LAST
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, pageSize, offset]
  );

  const usuarios = await Promise.all(rows.map(async (r) => {
    const key = keyFromStored(r.foto);
    return {
      id: r._id,
      nombre: `${r.primerNombre || ''} ${r.primerApellido || ''}`.trim() || '(sin nombre)',
      numeroId: r.numeroId || '',
      email: r.email || '',
      nivel: r.nivel || '',
      step: r.step || '',
      filename: key ? key.split('/').pop() : null,
      url: await resolveUrl(r.foto),
    };
  }));

  return successResponse({ usuarios, total, page, pageSize });
});
