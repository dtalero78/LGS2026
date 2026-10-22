import { NextRequest } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from '@/lib/errors';
import { queryMany, queryOne, query } from '@/lib/postgres';
import { generateTempPassword } from '@/lib/gen-password';
import { ids } from '@/lib/id-generator';
import { normalizarTelefono } from '@/lib/telefono';

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

  // ?catalogo=1 → roles asignables (ROL_PERMISOS activos) para "Cambiar rol".
  if (searchParams.get('catalogo')) {
    const catalogo = await queryMany<{ rol: string; descripcion: string | null }>(
      `SELECT "rol", "descripcion" FROM "ROL_PERMISOS"
        WHERE COALESCE("activo", true) = true AND UPPER("rol") <> 'ESTUDIANTE'
        ORDER BY "rol"`,
    );
    return successResponse({ catalogo });
  }

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
 * PATCH /api/postgres/users/consulta — dos acciones sobre la cuenta de acceso:
 *
 *   (a) Cambiar la clave     → body { id, password, motivo? }
 *       Fija la clave elegida (texto plano, como el resto del sistema). Mínimo 4
 *       caracteres. Queda en la auditoría (sin registrar el valor). Devuelve la
 *       nueva clave para mostrarla en la consulta.
 *
 *   (c) Cambiar de rol       → body { id, rol, motivo }  (motivo ≥10; no la propia
 *       cuenta; ESTUDIANTE no entra ni sale; SUPER_ADMIN/ADMIN solo por SUPER_ADMIN;
 *       el rol debe existir activo en ROL_PERMISOS). Rige al volver a iniciar sesión.
 *
 *   (b) Activar / desactivar → body { id, activo: boolean }
 *       `activo=false` BLOQUEA el login y ADEMÁS regenera la clave (invalida la
 *       anterior). `activo=true` solo reactiva (no toca la clave).
 *
 * Gateado por CREAR_ROL.
 */
export const PATCH = handlerWithAuth(async (request: NextRequest, _ctx, session) => {
  await requirePermission(session, MantenimientoPermission.CREAR_ROL);

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) throw new ValidationError('id requerido');

  // ── (a) Cambio de clave manual ──
  if (typeof body?.password === 'string') {
    const nueva = body.password.trim();
    if (nueva.length < 4) throw new ValidationError('La clave debe tener al menos 4 caracteres');
    const before = await queryOne<{ email: string; rol: string }>(
      `SELECT "email","rol" FROM "USUARIOS_ROLES" WHERE "_id" = $1`, [id],
    );
    if (!before) throw new NotFoundError('Usuario', id);
    const res = await query<{ email: string; password: string; activo: boolean }>(
      `UPDATE "USUARIOS_ROLES" SET "password" = $1, "_updatedDate" = NOW() WHERE "_id" = $2
       RETURNING "email","password","activo"`,
      [nueva, id],
    );
    await writeAudit({
      accion: 'EDITAR',
      usuarioRolId: id,
      email: before.email ?? null,
      rol: before.rol ?? null,
      // No se guarda el valor de la clave en la auditoría, solo que cambió.
      cambios: { password: { from: '(anterior oculta)', to: '(clave cambiada manualmente)' } },
      motivo: typeof body?.motivo === 'string' ? body.motivo.trim() || null : null,
      realizadoPor: (session?.user as any)?.email ?? null,
      realizadoPorNombre: (session?.user as any)?.name ?? null,
    });
    return successResponse({ email: res.rows[0].email, password: res.rows[0].password, activo: res.rows[0].activo });
  }

  // ── (c) Cambiar de rol ──
  if (typeof body?.rol === 'string') {
    const nuevo = body.rol.trim();
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : '';
    if (!nuevo) throw new ValidationError('rol requerido');
    if (motivo.length < 10) throw new ValidationError('Indica el motivo del cambio de rol (mínimo 10 caracteres).');

    const before = await queryOne<{ email: string; rol: string }>(
      `SELECT "email","rol" FROM "USUARIOS_ROLES" WHERE "_id" = $1`, [id],
    );
    if (!before) throw new NotFoundError('Usuario', id);
    const actual = String(before.rol || '').toUpperCase();
    const destino = nuevo.toUpperCase();
    if (actual === destino) throw new ValidationError(`La cuenta ya tiene el rol ${before.rol}.`);

    const yo = session?.user as any;
    if (String(yo?.email || '').toLowerCase() === String(before.email || '').toLowerCase()) {
      throw new ValidationError('No puedes cambiar el rol de tu propia cuenta.');
    }
    // Una cuenta de estudiante está ligada a su ficha académica; una de staff no debe
    // convertirse en estudiante (ni al revés): esas cuentas se crean en su propio flujo.
    if (actual === 'ESTUDIANTE' || destino === 'ESTUDIANTE') {
      throw new ValidationError('Las cuentas de estudiante no cambian de rol: se crean desde su ficha o en "Crear cuenta".');
    }
    // Dar o quitar acceso total solo lo hace un SUPER_ADMIN.
    const ADMINS = ['SUPER_ADMIN', 'ADMIN'];
    if ((ADMINS.includes(actual) || ADMINS.includes(destino)) && String(yo?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Solo un Super Administrador puede asignar o quitar los roles SUPER_ADMIN / ADMIN.');
    }
    const existe = await queryOne<{ rol: string }>(
      `SELECT "rol" FROM "ROL_PERMISOS" WHERE UPPER("rol") = $1 AND COALESCE("activo", true) = true LIMIT 1`, [destino],
    );
    if (!existe && !ADMINS.includes(destino)) throw new ValidationError(`El rol ${nuevo} no existe o está inactivo.`);
    const rolFinal = existe?.rol ?? destino;

    const res = await query<{ email: string; rol: string }>(
      `UPDATE "USUARIOS_ROLES" SET "rol" = $1, "_updatedDate" = NOW() WHERE "_id" = $2 RETURNING "email","rol"`,
      [rolFinal, id],
    );
    await writeAudit({
      accion: 'EDITAR',
      usuarioRolId: id,
      email: before.email ?? null,
      rol: before.rol ?? null,
      cambios: { rol: { from: before.rol ?? null, to: rolFinal } },
      motivo,
      realizadoPor: yo?.email ?? null,
      realizadoPorNombre: yo?.name ?? null,
    });
    return successResponse({ email: res.rows[0].email, rol: res.rows[0].rol });
  }

  // ── (b) Activar / desactivar ──
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

  // Cuenta de un ADVISOR: su ficha (ADVISORS.activo) sigue al login, para que la lista
  // de advisors y Lgs-Buckets no lo muestren activo con el login bloqueado (o al revés).
  // Vinculada por usuarioRolId o, si no lo tiene, por email.
  await query(
    // Al desactivar se libera también su sala de Zoom (queda en zoomLiberado), igual que
    // POST /api/postgres/advisors/[id]/estado.
    `UPDATE "ADVISORS" a SET "activo" = $1,
            "zoomLiberado"   = CASE WHEN $1 = false AND COALESCE(TRIM(a."zoom"),'') <> '' THEN a."zoom" ELSE a."zoomLiberado" END,
            "zoomLiberadoEn" = CASE WHEN $1 = false AND COALESCE(TRIM(a."zoom"),'') <> '' THEN NOW() ELSE a."zoomLiberadoEn" END,
            "zoom"           = CASE WHEN $1 = false THEN NULL ELSE a."zoom" END,
            "_updatedDate" = NOW()
       FROM "USUARIOS_ROLES" u
      WHERE u."_id" = $2 AND UPPER(COALESCE(u."rol",'')) = 'ADVISOR'
        AND ( a."usuarioRolId" = u."_id"
           OR (a."usuarioRolId" IS NULL AND LOWER(TRIM(a."email")) = LOWER(TRIM(u."email"))) )`,
    [body.activo, id],
  ).catch((e) => console.error('[users/consulta] no se pudo sincronizar ADVISORS.activo:', e?.message));

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
    // celular: solo dígitos y con indicativo (regla única de lib/telefono)
    if (f === 'celular')  v = normalizarTelefono(v, body.plataforma ?? current.plataforma) ?? '';
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
