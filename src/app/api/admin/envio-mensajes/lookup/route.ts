/**
 * POST /api/admin/envio-mensajes/lookup
 *
 * Resuelve un array de `numeroIds` contra ACADEMICA y devuelve la información
 * necesaria para mostrar el preview de destinatarios.
 *
 * Por cada numeroId:
 *   - Normaliza (quita puntos/espacios/dashes + UPPER)
 *   - LEFT JOIN PEOPLE para obtener peopleId (para edición de celular después)
 *   - Si hay duplicados en ACADEMICA por numeroId → prefiere BENEFICIARIO
 *   - Valida que tenga celular >= 10 dígitos
 *
 * Body: { numeroIds: string[] }   max 300
 *
 * Response: {
 *   items: [{
 *     numeroIdOriginal, numeroId,                  // raw + normalizado
 *     valido, error?,
 *     academicaId?, peopleId?, usuarioRolEmail?,   // ids útiles para update-celular
 *     nombre?, primerApellido?, celular?,
 *     nivel?, step?, plataforma?, contrato?,
 *     estadoInactivo?
 *   }],
 *   resumen: { total, validos, invalidos }
 * }
 *
 * Permiso: MANTENIMIENTO.USUARIOS.ENVIO_MENSAJES (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError } from '@/lib/errors';
import { query } from '@/lib/postgres';
import { normalizeNumeroIdList, normalizeNumeroId } from '@/lib/numeroid-normalize';

const MAX_LOOKUP = 300;

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.ENVIO_MENSAJES);

  const body = await request.json();
  const raw: any[] = Array.isArray(body?.numeroIds) ? body.numeroIds : [];
  if (raw.length === 0) throw new ValidationError('numeroIds requerido (array no vacío)');
  if (raw.length > MAX_LOOKUP) {
    throw new ValidationError(`Máximo ${MAX_LOOKUP} numeroIds por operación. Recibidos: ${raw.length}`);
  }

  // Map de original→normalizado preservando orden de entrada
  const normalizedSet = normalizeNumeroIdList(raw.map(String));
  // Si después de normalizar quedan 0 → todos eran vacíos
  if (normalizedSet.length === 0) {
    throw new ValidationError('Todos los numeroIds están vacíos después de normalizar.');
  }

  // Query única: por cada numeroId del array, busca su mejor match en ACADEMICA
  // (prefiere BENEFICIARIO si hay duplicados). DISTINCT ON garantiza 1 fila por numeroId.
  // LEFT JOIN PEOPLE por numeroId para tener peopleId (necesario para update-celular).
  // LEFT JOIN USUARIOS_ROLES por email para tener el email actual del login.
  const rows = await query<any>(
    `WITH ids AS (
       SELECT UNNEST($1::text[]) AS "numeroId"
     )
     SELECT
       i."numeroId"                            AS "numeroId",
       a."_id"                                 AS "academicaId",
       a."primerNombre"                        AS "nombre",
       a."primerApellido"                      AS "primerApellido",
       a."celular"                             AS "celular",
       a."nivel", a."step", a."plataforma", a."contrato",
       a."estadoInactivo"                      AS "estadoInactivo",
       p."_id"                                 AS "peopleId",
       ur."email"                              AS "usuarioRolEmail"
     FROM ids i
     LEFT JOIN LATERAL (
       SELECT *
       FROM "ACADEMICA" aa
       WHERE UPPER(REGEXP_REPLACE(COALESCE(aa."numeroId",''), '[.\\s\\-_]', '', 'g')) = i."numeroId"
       ORDER BY CASE WHEN aa."tipoUsuario" = 'BENEFICIARIO' THEN 0 ELSE 1 END,
                aa."_createdDate" DESC NULLS LAST
       LIMIT 1
     ) a ON true
     LEFT JOIN LATERAL (
       SELECT *
       FROM "PEOPLE" pp
       WHERE UPPER(REGEXP_REPLACE(COALESCE(pp."numeroId",''), '[.\\s\\-_]', '', 'g')) = i."numeroId"
       ORDER BY CASE WHEN pp."tipoUsuario" = 'BENEFICIARIO' THEN 0 ELSE 1 END,
                pp."_createdDate" DESC NULLS LAST
       LIMIT 1
     ) p ON true
     LEFT JOIN "USUARIOS_ROLES" ur
       ON a."email" IS NOT NULL AND LOWER(ur."email") = LOWER(a."email")`,
    [normalizedSet],
  );

  const byNumeroId = new Map<string, any>(rows.rows.map((r: any) => [r.numeroId, r]));

  const items = raw.map(orig => {
    const n = normalizeNumeroId(String(orig));
    if (!n) {
      return { numeroIdOriginal: String(orig), numeroId: '', valido: false, error: 'vacío' };
    }
    const r = byNumeroId.get(n);
    if (!r || !r.academicaId) {
      return { numeroIdOriginal: String(orig), numeroId: n, valido: false, error: 'No encontrado en ACADEMICA' };
    }
    const cel = String(r.celular || '').replace(/\D/g, '');
    if (!cel) {
      return {
        numeroIdOriginal: String(orig),
        numeroId: n,
        valido: false,
        error: 'Sin celular registrado',
        academicaId: r.academicaId,
        peopleId: r.peopleId || null,
        usuarioRolEmail: r.usuarioRolEmail || null,
        nombre: r.nombre, primerApellido: r.primerApellido,
        nivel: r.nivel, step: r.step, plataforma: r.plataforma, contrato: r.contrato,
        estadoInactivo: r.estadoInactivo,
      };
    }
    if (cel.length < 10) {
      return {
        numeroIdOriginal: String(orig),
        numeroId: n,
        valido: false,
        error: `Celular inválido (${cel.length} dígitos)`,
        academicaId: r.academicaId,
        peopleId: r.peopleId || null,
        usuarioRolEmail: r.usuarioRolEmail || null,
        nombre: r.nombre, primerApellido: r.primerApellido,
        celular: r.celular,
        nivel: r.nivel, step: r.step, plataforma: r.plataforma, contrato: r.contrato,
        estadoInactivo: r.estadoInactivo,
      };
    }
    return {
      numeroIdOriginal: String(orig),
      numeroId: n,
      valido: true,
      academicaId: r.academicaId,
      peopleId: r.peopleId || null,
      usuarioRolEmail: r.usuarioRolEmail || null,
      nombre: r.nombre, primerApellido: r.primerApellido,
      celular: r.celular,
      nivel: r.nivel, step: r.step, plataforma: r.plataforma, contrato: r.contrato,
      estadoInactivo: r.estadoInactivo,
    };
  });

  const validos = items.filter(x => x.valido).length;
  return successResponse({
    items,
    resumen: { total: items.length, validos, invalidos: items.length - validos },
  });
});
