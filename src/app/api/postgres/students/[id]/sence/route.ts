import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query, queryOne } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * POST /api/postgres/students/[id]/sence
 *
 * Gestión de la marca SENCE del estudiante ([id] = ACADEMICA._id).
 *   body { action: 'desmarcar' }        → sence=false en PEOPLE y ACADEMICA
 *                                          (por numeroId) + limpia senceCode.
 *   body { action: 'set-code', code }   → guarda senceCode (alfanumérico) en ACADEMICA.
 */
export const POST = handlerWithAuth(async (request, { params }, _session) => {
  const id = params.id;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  const aca = await queryOne<{ numeroId: string }>(
    `SELECT "numeroId" FROM "ACADEMICA" WHERE "_id" = $1`, [id],
  );
  if (!aca) throw new NotFoundError('Registro académico', id);
  const numeroId = aca.numeroId;

  if (action === 'desmarcar') {
    // sence=false en TODAS las filas del documento (titular + beneficiario) y
    // se limpia el código en ACADEMICA.
    await query(`UPDATE "PEOPLE" SET "sence" = false, "_updatedDate" = NOW() WHERE "numeroId" = $1`, [numeroId]);
    await query(`UPDATE "ACADEMICA" SET "sence" = false, "senceCode" = NULL, "_updatedDate" = NOW() WHERE "numeroId" = $1`, [numeroId]);
    return successResponse({ ok: true, sence: false, senceCode: null });
  }

  if (action === 'set-code') {
    const code = String(body?.code || '').trim();
    if (!code) throw new ValidationError('El código SENCE es requerido');
    if (!/^[A-Za-z0-9-]+$/.test(code)) throw new ValidationError('El código SENCE debe ser alfanumérico');
    await query(`UPDATE "ACADEMICA" SET "senceCode" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`, [code, id]);
    return successResponse({ ok: true, senceCode: code });
  }

  throw new ValidationError("action inválida (usa 'desmarcar' o 'set-code')");
});
