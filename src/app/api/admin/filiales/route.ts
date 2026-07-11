/**
 * Filiales — catálogo por plataforma para el alta de comerciales.
 *
 *   GET  ?plataforma=Chile   → lista de filiales activas (todas si no se pasa)
 *   POST { nombre, plataforma } → agrega una filial
 *
 * Permiso: MANTENIMIENTO.USUARIOS.CREAR_ROL (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, ConflictError } from '@/lib/errors';
import { queryMany, queryOne } from '@/lib/postgres';
import crypto from 'crypto';

// Crea la tabla si aún no existe (respaldo idempotente por si el deploy corre
// antes de la migración manual).
async function ensureTable() {
  await queryOne(
    `CREATE TABLE IF NOT EXISTS "FILIALES" (
       "_id" TEXT PRIMARY KEY,
       "nombre" TEXT NOT NULL,
       "plataforma" TEXT NOT NULL,
       "activo" BOOLEAN DEFAULT true,
       "_createdDate" TIMESTAMPTZ DEFAULT NOW(),
       "_updatedDate" TIMESTAMPTZ DEFAULT NOW()
     )`,
  );
  await queryOne(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_filiales_nombre_plataforma" ON "FILIALES" (LOWER(TRIM("nombre")), "plataforma")`);
}

export const GET = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);
  await ensureTable();

  const { searchParams } = new URL(request.url);
  const plataforma = (searchParams.get('plataforma') || '').trim();

  const rows = plataforma
    ? await queryMany(
        `SELECT "_id","nombre","plataforma","activo","_createdDate" FROM "FILIALES"
          WHERE "activo" = true AND LOWER(TRIM("plataforma")) = LOWER(TRIM($1))
          ORDER BY "nombre" ASC`,
        [plataforma],
      )
    : await queryMany(
        `SELECT "_id","nombre","plataforma","activo","_createdDate" FROM "FILIALES"
          WHERE "activo" = true
          ORDER BY "plataforma" ASC, "nombre" ASC`,
      );

  return successResponse({ filiales: rows, count: rows.length });
});

export const POST = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);
  await ensureTable();

  const body = await request.json();
  const nombre = (body?.nombre || '').trim();
  const plataforma = (body?.plataforma || '').trim();

  if (!plataforma) throw new ValidationError('Debe seleccionar una plataforma');
  if (!nombre) throw new ValidationError('El nombre de la filial es requerido');

  const dup = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "FILIALES"
      WHERE LOWER(TRIM("nombre")) = LOWER(TRIM($1)) AND LOWER(TRIM("plataforma")) = LOWER(TRIM($2)) LIMIT 1`,
    [nombre, plataforma],
  );
  if (dup) throw new ConflictError(`Ya existe la filial "${nombre}" en ${plataforma}`);

  const inserted = await queryOne(
    `INSERT INTO "FILIALES" ("_id","nombre","plataforma","activo","_createdDate","_updatedDate")
     VALUES ($1,$2,$3,true,NOW(),NOW())
     RETURNING "_id","nombre","plataforma","activo","_createdDate"`,
    [crypto.randomUUID(), nombre, plataforma],
  );

  return successResponse({ filial: inserted });
});
