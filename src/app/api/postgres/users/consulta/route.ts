import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { queryMany, queryOne, query } from '@/lib/postgres';
import { generateTempPassword } from '@/lib/gen-password';
import { ids } from '@/lib/id-generator';

/**
 * Auditoría de ediciones/eliminaciones de cuentas de acceso. Tabla auto-creada
 * (`CREATE TABLE IF NOT EXISTS`) al primer uso, como el resto de tablas de
 * auditoría del proyecto (auditautoaprov, ADVISOR_NOTES_AUDIT, …).
 *   accion 'EDITAR'   → `cambios` = { campo: { from, to } }
 *   accion 'ELIMINAR' → `cambios` = snapshot completo de la fila (recuperable)
 */
async function ensureAuditTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS "USUARIOS_ROLES_AUDIT" (
      "_id" VARCHAR(255) PRIMARY KEY,
      "accion" VARCHAR(20) NOT NULL,
      "usuarioRolId" VARCHAR(255),
      "email" VARCHAR(255),
      "rol" VARCHAR(100),
      "cambios" JSONB,
      "motivo" TEXT,
      "realizadoPor" VARCHAR(255),
      "realizadoPorNombre" VARCHAR(255),
      "_createdDate" TIMESTAMPTZ DEFAULT NOW()
    )`);
}

async function writeAudit(entry: {
  accion: 'EDITAR' | 'ELIMINAR';
  usuarioRolId: string;
  email: string | null;
  rol: string | null;
  cambios: any;
  motivo: string | null;
  realizadoPor: string | null;
  realizadoPorNombre: string | null;
}) {
  await ensureAuditTable();
  await query(
    `INSERT INTO "USUARIOS_ROLES_AUDIT"
       ("_id","accion","usuarioRolId","email","rol","cambios","motivo","realizadoPor","realizadoPorNombre")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [ids.audit(), entry.accion, entry.usuarioRolId, entry.email, entry.rol,
     JSON.stringify(entry.cambios ?? null), entry.motivo, entry.realizadoPor, entry.realizadoPorNombre],
  );
}

// Campos editables desde la consulta (los sensibles NO: email es la llave de
// sincronización, rol y clave tienen sus propios flujos).
const EDITABLE_FIELDS = ['nombre', 'apellido', 'celular', 'numberid', 'plataforma'] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

/**
 * GET /api/postgres/users/consulta?rol=&search=
 *
 * Consulta de USUARIOS_ROLES por rol (email, nombre, teléfono, usuario=numberid,
 * clave=password). Muestra credenciales → gateado por MANTENIMIENTO.USUARIOS.CREAR_ROL
 * (SUPER_ADMIN/ADMIN bypass).
 *
 *   sin `rol`         → { roles: [{ rol, total }] }  (para poblar el dropdown)
 *   con `rol=X`       → { users: [...] }  (rol='__ALL__' devuelve todos)
 */
export const GET = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const { searchParams } = new URL(request.url);
  const rol = (searchParams.get('rol') || '').trim();
  const search = (searchParams.get('search') || '').trim().toLowerCase();

  // Sin rol → lista de roles con conteo para el dropdown.
  if (!rol) {
    const roles = await queryMany<{ rol: string; total: number }>(
      `SELECT "rol", COUNT(*)::int AS total
         FROM "USUARIOS_ROLES"
        GROUP BY "rol"
        ORDER BY "rol"`,
    );
    return successResponse({ roles });
  }

  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (rol !== '__ALL__') { conditions.push(`"rol" = $${i++}`); params.push(rol); }
  if (search) {
    conditions.push(
      `(LOWER("email") LIKE $${i} OR LOWER(COALESCE("nombre",'')) LIKE $${i} OR LOWER(COALESCE("apellido",'')) LIKE $${i} OR LOWER(COALESCE("numberid",'')) LIKE $${i} OR LOWER(COALESCE("celular",'')) LIKE $${i})`,
    );
    params.push(`%${search}%`); i++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const users = await queryMany(
    `SELECT "_id", "email", "nombre", "apellido", "celular", "numberid", "password", "rol", "plataforma", "activo"
       FROM "USUARIOS_ROLES"
       ${where}
      ORDER BY "nombre" NULLS LAST, "apellido" NULLS LAST
      LIMIT 5000`,
    params,
  );

  return successResponse({ users });
});

/**
 * PATCH /api/postgres/users/consulta — activa/desactiva la cuenta de acceso.
 *   body { id: USUARIOS_ROLES._id, activo: boolean }
 * `activo=false` BLOQUEA el login de esa cuenta y ADEMÁS le cambia la clave por
 * una nueva (invalida la anterior). `activo=true` solo reactiva (no toca la clave).
 * La nueva clave se devuelve para mostrarla en la consulta. Gateado por CREAR_ROL.
 */
export const PATCH = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) throw new ValidationError('id requerido');
  if (typeof body?.activo !== 'boolean') throw new ValidationError('activo debe ser booleano');

  // Al DESACTIVAR: además de activo=false, se genera una clave nueva (la anterior
  // deja de servir). Al ACTIVAR: solo se reactiva, la clave no se toca.
  const res = body.activo === false
    ? await query<{ email: string; activo: boolean; password: string }>(
        `UPDATE "USUARIOS_ROLES" SET "activo" = false, "password" = $1 WHERE "_id" = $2
         RETURNING "email", "activo", "password"`,
        [generateTempPassword(), id],
      )
    : await query<{ email: string; activo: boolean; password: string }>(
        `UPDATE "USUARIOS_ROLES" SET "activo" = true WHERE "_id" = $1
         RETURNING "email", "activo", "password"`,
        [id],
      );
  if (!res.rowCount) throw new NotFoundError('Usuario', id);

  return successResponse({ email: res.rows[0].email, activo: res.rows[0].activo, password: res.rows[0].password });
});

/**
 * PUT /api/postgres/users/consulta — edita campos de la cuenta de acceso
 * (rellenar vacíos o modificar existentes). Solo toca USUARIOS_ROLES.
 *   body { id, nombre?, apellido?, celular?, numberid?, plataforma? }
 * Registra la auditoría con el diff (antes→después). Gateado por CREAR_ROL.
 */
export const PUT = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) throw new ValidationError('id requerido');

  // Fila actual (para diff de auditoría + validaciones).
  const current = await queryOne<Record<string, any>>(
    `SELECT "_id","email","rol","nombre","apellido","celular","numberid","plataforma"
       FROM "USUARIOS_ROLES" WHERE "_id" = $1`,
    [id],
  );
  if (!current) throw new NotFoundError('Usuario', id);

  // Normaliza y recoge SOLO los campos presentes en el body.
  const next: Partial<Record<EditableField, string | null>> = {};
  for (const f of EDITABLE_FIELDS) {
    if (!(f in body)) continue;
    let v: string | null = body[f] == null ? '' : String(body[f]).trim();
    if (f === 'celular')  v = v.replace(/\D/g, '');           // solo dígitos (para OTP)
    if (f === 'numberid') v = v.toUpperCase().replace(/[.\s]/g, ''); // canónico (RUT chileno, etc.)
    next[f] = v === '' ? null : v;
  }
  if (Object.keys(next).length === 0) throw new ValidationError('No hay campos para actualizar');

  // numberid único (excluyéndose a sí mismo) — evita duplicados que rompen logins.
  if (next.numberid) {
    const dup = await queryOne<{ email: string; rol: string }>(
      `SELECT "email","rol" FROM "USUARIOS_ROLES"
        WHERE UPPER(TRIM("numberid")) = $1 AND "_id" <> $2 LIMIT 1`,
      [next.numberid, id],
    );
    if (dup) throw new ConflictError(`El número de identificación ya está en uso por ${dup.email} (${dup.rol})`);
  }

  // Diff: solo los campos que realmente cambian.
  const cambios: Record<string, { from: any; to: any }> = {};
  const setParts: string[] = [];
  const setParams: any[] = [];
  let p = 1;
  for (const [f, to] of Object.entries(next)) {
    const from = current[f] ?? null;
    if ((from ?? null) === (to ?? null)) continue;
    cambios[f] = { from, to };
    setParts.push(`"${f}" = $${p++}`);
    setParams.push(to);
  }
  if (setParts.length === 0) {
    return successResponse({ user: current, sinCambios: true });
  }

  setParams.push(id);
  const updated = await query<Record<string, any>>(
    `UPDATE "USUARIOS_ROLES" SET ${setParts.join(', ')}, "_updatedDate" = NOW()
      WHERE "_id" = $${p}
      RETURNING "_id","email","nombre","apellido","celular","numberid","password","rol","plataforma","activo"`,
    setParams,
  );

  await writeAudit({
    accion: 'EDITAR',
    usuarioRolId: id,
    email: current.email ?? null,
    rol: current.rol ?? null,
    cambios,
    motivo: typeof body?.motivo === 'string' ? body.motivo.trim() || null : null,
    realizadoPor: (session?.user as any)?.email ?? null,
    realizadoPorNombre: (session?.user as any)?.name ?? null,
  });

  return successResponse({ user: updated.rows[0], cambios });
});

/**
 * DELETE /api/postgres/users/consulta — elimina la cuenta de acceso.
 *   body { id, motivo }
 * Snapshotea la fila completa en la auditoría ANTES de borrar (recuperable).
 * `motivo` obligatorio. Gateado por CREAR_ROL.
 */
export const DELETE = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : '';
  if (!id) throw new ValidationError('id requerido');
  if (!motivo) throw new ValidationError('El motivo es obligatorio para eliminar');

  // Snapshot completo de la fila (recuperable desde la auditoría).
  const snap = await queryOne<Record<string, any>>(
    `SELECT to_jsonb(u) AS row, u."email", u."rol"
       FROM "USUARIOS_ROLES" u WHERE u."_id" = $1`,
    [id],
  );
  if (!snap) throw new NotFoundError('Usuario', id);

  await writeAudit({
    accion: 'ELIMINAR',
    usuarioRolId: id,
    email: snap.email ?? null,
    rol: snap.rol ?? null,
    cambios: snap.row,
    motivo,
    realizadoPor: (session?.user as any)?.email ?? null,
    realizadoPorNombre: (session?.user as any)?.name ?? null,
  });

  await query(`DELETE FROM "USUARIOS_ROLES" WHERE "_id" = $1`, [id]);

  return successResponse({ deleted: true, email: snap.email });
});
