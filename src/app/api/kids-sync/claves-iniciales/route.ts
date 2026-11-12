import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { queryMany } from '@/lib/postgres';
import { exigirClaveKids } from '@/lib/kids-sync-server';

/**
 * POST /api/kids-sync/claves-iniciales — la clave INICIAL que LGS guardó de cada
 * niño al matricularlo en KIDS (`KIDS_INSCRIPCIONES.kidsPassword`), para que KIDS
 * recupere la copia de su bóveda (2026-11-12). Algunas cuentas de KIDS (las de
 * AGOSTO2026, creadas por un script sin la llave) solo tienen el hash y no se
 * pueden mostrar ni enviar.
 *
 * KIDS la comprueba contra SU hash y solo la guarda si coincide: una clave que el
 * niño ya cambió se descarta allá. Solo con la clave de servicio de KIDS
 * (`x-api-key`), y la respuesta no se registra: el log dice cuántas, nunca cuáles.
 *
 * Body: { externalRefs: string[] } (máx. 200). Respuesta:
 *   { claves: [{ externalRef, username, clave }] } — solo las que LGS tiene.
 */
const MAX = 200;

export const POST = handler(async (request) => {
  exigirClaveKids(request);
  const body = await request.json().catch(() => ({}));
  const refs = Array.isArray(body?.externalRefs)
    ? [...new Set((body.externalRefs as unknown[]).map((r) => String(r ?? '').trim()).filter((r) => r.includes('#')))]
    : [];
  if (refs.length === 0) throw new ValidationError('externalRefs es obligatorio (contrato#documento).');
  if (refs.length > MAX) throw new ValidationError(`Máximo ${MAX} por llamada.`);

  const filas = await queryMany<{ externalRef: string; username: string | null; clave: string | null }>(
    `SELECT DISTINCT ON (k."kidsExternalRef")
            k."kidsExternalRef" AS "externalRef", k."kidsUsername" AS username, k."kidsPassword" AS clave
       FROM "KIDS_INSCRIPCIONES" k
      WHERE k."kidsExternalRef" = ANY($1::text[])
        AND COALESCE(k."kidsPassword", '') <> ''
      ORDER BY k."kidsExternalRef", k."_createdDate" DESC`,
    [refs],
  );
  console.log(`[kids-sync/claves-iniciales] pedidas ${refs.length}, entregadas ${filas.length}`);
  const resp = successResponse({ claves: filas });
  resp.headers.set('Cache-Control', 'no-store');
  return resp;
});
