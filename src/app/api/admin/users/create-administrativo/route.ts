/**
 * Crea UserRol → opción "Administrativo".
 *
 * Crea una cuenta de staff en USUARIOS_ROLES con un rol administrativo
 * (cualquier rol de ROL_PERMISOS excepto ESTUDIANTE / ADVISOR / COMERCIAL,
 * que tienen su propio flujo). La clave se auto-genera y se devuelve una vez.
 *
 *   POST { rol, nombre, apellido?, email, celular?, numberid?, plataforma? }
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

// Roles que NO se crean por esta vía (tienen su propia opción en la página).
const EXCLUDED_ROLES = new Set(['ESTUDIANTE', 'ADVISOR', 'COMERCIAL']);

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handlerWithAuth(async (request, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const body = await request.json();
  const rol = (body?.rol || '').trim();
  const nombre = (body?.nombre || '').trim();
  const apellido = (body?.apellido || '').trim() || null;
  const email = (body?.email || '').trim().toLowerCase();
  const celular = (body?.celular || '').trim() || null;
  const numberid = (body?.numberid || '').trim().toUpperCase() || null;
  const plataforma = (body?.plataforma || '').trim() || null;

  // Validaciones de entrada
  if (!rol) throw new ValidationError('Debe seleccionar un rol');
  if (EXCLUDED_ROLES.has(rol.toUpperCase())) {
    throw new ValidationError(`El rol ${rol} tiene su propia opción (Estudiante / Advisor / Comercial)`);
  }
  if (!nombre) throw new ValidationError('El nombre es requerido');
  if (!email) throw new ValidationError('El correo es requerido');
  if (!emailRe.test(email)) throw new ValidationError('El correo no es válido');

  // El rol debe existir (y estar activo) en ROL_PERMISOS.
  const rolRow = await queryOne<{ rol: string; activo: boolean | null }>(
    `SELECT "rol", "activo" FROM "ROL_PERMISOS" WHERE "rol" = $1 LIMIT 1`,
    [rol],
  );
  if (!rolRow) throw new ValidationError(`El rol ${rol} no existe en ROL_PERMISOS`);
  if (rolRow.activo === false) throw new ValidationError(`El rol ${rol} está inactivo`);

  // Email único en USUARIOS_ROLES (tolerante a espacios/caso).
  const existing = await queryOne<{ _id: string; rol: string; nombre: string | null }>(
    `SELECT "_id","rol","nombre" FROM "USUARIOS_ROLES"
      WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) LIMIT 1`,
    [email],
  );
  if (existing) {
    throw new ConflictError(
      `Ya existe una cuenta con ese correo (rol ${existing.rol}${existing.nombre ? ' — ' + existing.nombre : ''})`,
    );
  }
  // numberid único si viene
  if (numberid) {
    const byNum = await queryOne<{ rol: string; nombre: string | null }>(
      `SELECT "rol","nombre" FROM "USUARIOS_ROLES"
        WHERE UPPER(TRIM("numberid")) = UPPER(TRIM($1)) LIMIT 1`,
      [numberid],
    );
    if (byNum) {
      throw new ConflictError(
        `Ya existe un usuario con ese número de identificación (rol ${byNum.rol}${byNum.nombre ? ' — ' + byNum.nombre : ''})`,
      );
    }
  }

  const password = generateTempPassword();
  const newId = crypto.randomUUID();
  const inserted = await queryOne<any>(
    `INSERT INTO "USUARIOS_ROLES" (
       "_id", "email", "nombre", "apellido", "password", "rol",
       "activo", "celular", "numberid", "plataforma",
       "origen", "fechaCreacion", "fechaActualizacion",
       "_createdDate", "_updatedDate"
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       true, $7, $8, $9,
       'ADMIN', NOW(), NOW(),
       NOW(), NOW()
     )
     RETURNING "_id", "email", "nombre", "apellido", "rol",
               "celular", "numberid", "plataforma", "_createdDate"`,
    [newId, email, nombre, apellido, password, rol, celular, numberid, plataforma],
  );

  return successResponse({ user: inserted, generatedPassword: password });
});
