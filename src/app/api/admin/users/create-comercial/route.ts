/**
 * Crea UserRol → opción "Comercial".
 *
 * Crea una fila en EQUIPO_COMERCIAL Y el login en USUARIOS_ROLES (rol
 * COMERCIAL), enlazados por `usuarioRolId` (análogo a ADVISORS.usuarioRolId).
 * La clave se auto-genera y se guarda en ambos (texto plano) y se devuelve
 * una vez para que el admin la copie.
 *
 *   POST { nombre, correo, plataforma?, filial? }
 *
 * Permiso: MANTENIMIENTO.USUARIOS.CREAR_ROL (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, ConflictError } from '@/lib/errors';
import { queryOne } from '@/lib/postgres';
import { generateTempPassword } from '@/lib/gen-password';
import crypto from 'crypto';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crea la tabla si aún no existe (idempotente). Respaldo por si el deploy corre
// antes de aplicar la migración manual.
async function ensureTable() {
  await queryOne(
    `CREATE TABLE IF NOT EXISTS "EQUIPO_COMERCIAL" (
       "_id" TEXT PRIMARY KEY,
       "nombre" TEXT NOT NULL,
       "correo" TEXT NOT NULL,
       "plataforma" TEXT,
       "filial" TEXT,
       "clave" TEXT,
       "usuarioRolId" TEXT,
       "activo" BOOLEAN DEFAULT true,
       "_createdDate" TIMESTAMPTZ DEFAULT NOW(),
       "_updatedDate" TIMESTAMPTZ DEFAULT NOW()
     )`,
  );
  await queryOne(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_equipo_comercial_correo" ON "EQUIPO_COMERCIAL" (LOWER(TRIM("correo")))`);
}

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);
  await ensureTable();

  const body = await request.json();
  const nombre = (body?.nombre || '').trim();
  const correo = (body?.correo || '').trim().toLowerCase();
  const plataforma = (body?.plataforma || '').trim() || null;
  const filial = (body?.filial || '').trim() || null;

  if (!nombre) throw new ValidationError('El nombre es requerido');
  if (!correo) throw new ValidationError('El correo es requerido');
  if (!emailRe.test(correo)) throw new ValidationError('El correo no es válido');

  // Único en USUARIOS_ROLES
  const userDup = await queryOne<{ rol: string; nombre: string | null }>(
    `SELECT "rol","nombre" FROM "USUARIOS_ROLES"
      WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) LIMIT 1`,
    [correo],
  );
  if (userDup) {
    throw new ConflictError(
      `Ya existe una cuenta con ese correo (rol ${userDup.rol}${userDup.nombre ? ' — ' + userDup.nombre : ''})`,
    );
  }
  // Único en EQUIPO_COMERCIAL
  const eqDup = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "EQUIPO_COMERCIAL" WHERE LOWER(TRIM("correo")) = LOWER(TRIM($1)) LIMIT 1`,
    [correo],
  );
  if (eqDup) throw new ConflictError('Ya existe un comercial registrado con ese correo');

  const password = generateTempPassword();

  // 1) Login en USUARIOS_ROLES (rol COMERCIAL)
  const usuarioRolId = crypto.randomUUID();
  await queryOne(
    `INSERT INTO "USUARIOS_ROLES" (
       "_id", "email", "nombre", "password", "rol",
       "activo", "plataforma", "origen",
       "fechaCreacion", "fechaActualizacion", "_createdDate", "_updatedDate"
     ) VALUES (
       $1, $2, $3, $4, 'COMERCIAL',
       true, $5, 'ADMIN',
       NOW(), NOW(), NOW(), NOW()
     )`,
    [usuarioRolId, correo, nombre, password, plataforma],
  );

  // 2) Registro en EQUIPO_COMERCIAL enlazado al login
  const comercialId = crypto.randomUUID();
  const inserted = await queryOne<any>(
    `INSERT INTO "EQUIPO_COMERCIAL" (
       "_id", "nombre", "correo", "plataforma", "filial", "clave",
       "usuarioRolId", "activo", "_createdDate", "_updatedDate"
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, true, NOW(), NOW()
     )
     RETURNING "_id", "nombre", "correo", "plataforma", "filial", "usuarioRolId", "_createdDate"`,
    [comercialId, nombre, correo, plataforma, filial, password, usuarioRolId],
  );

  return successResponse({ comercial: inserted, usuarioRolId, generatedPassword: password });
});
