/**
 * API: /api/postgres/admin/lgs-buckets/advisors  (GET)
 *
 * Lista las fotos de advisors almacenadas en DO Spaces (ADVISORS.fotoAdvisor),
 * con un presigned URL por foto para ver/descargar. Sólo lectura.
 * Gated por MANTENIMIENTO.LGS_BUCKETS.VER (SUPER_ADMIN/ADMIN bypass).
 */
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { queryMany } from '@/lib/postgres';
import { getPresignedVideoUrl } from '@/lib/spaces';

/** Convierte el valor guardado (key de Spaces o URL CDN) a una key; null si no es de Spaces. */
function keyFromStored(stored: string | null): string | null {
  const s = (stored || '').trim();
  if (!s || s.startsWith('wix:')) return null;
  const m = s.match(/digitaloceanspaces\.com\/(.+)$/i);
  if (m) return decodeURIComponent(m[1]);
  if (/^https?:\/\//i.test(s)) return null; // URL externa no-Spaces
  return s; // ya es una key
}

/** URL mostrable/descargable: presigned (Spaces) | directa (externa pública) | null. */
async function resolveUrl(stored: string | null): Promise<string | null> {
  const s = (stored || '').trim();
  if (!s || s.startsWith('wix:')) return null;
  if (/^https?:\/\//i.test(s) && !/digitaloceanspaces\.com/i.test(s)) return s;
  const key = keyFromStored(s);
  if (!key) return null;
  try { return await getPresignedVideoUrl(key, 3600); } catch { return null; }
}

export const GET = handlerWithAuth(async (_req, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LGS_BUCKETS);

  const rows = await queryMany<any>(
    `SELECT "_id", "nombreCompleto", "primerNombre", "primerApellido", "email", "fotoAdvisor", "activo"
     FROM "ADVISORS"
     WHERE "fotoAdvisor" IS NOT NULL AND TRIM("fotoAdvisor") <> ''
     ORDER BY "nombreCompleto" NULLS LAST, "primerApellido" NULLS LAST`
  );

  const advisors = await Promise.all(rows.map(async (r) => {
    const nombre = (r.nombreCompleto || `${r.primerNombre || ''} ${r.primerApellido || ''}`).trim();
    const key = keyFromStored(r.fotoAdvisor);
    return {
      id: r._id,
      nombre: nombre || '(sin nombre)',
      email: r.email || '',
      activo: r.activo,
      filename: key ? key.split('/').pop() : null,
      url: await resolveUrl(r.fotoAdvisor),
    };
  }));

  return successResponse({ advisors, total: advisors.length });
});
