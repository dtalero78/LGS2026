/**
 * Crea UserRol → opción "Administrativo".
 *
 * Crea una cuenta de staff en USUARIOS_ROLES con un rol administrativo
 * (cualquier rol de ROL_PERMISOS excepto ESTUDIANTE / ADVISOR / COMERCIAL,
 * que tienen su propio flujo). La clave se auto-genera y se devuelve una vez.
 *
 *   POST { rol, nombre, apellido?, email, celular?, numberid?, plataforma?,
 *          montomensual?, vigenstart?, vigenfinal?, fechaopcional? }
 *
 * Si el rol es de RECAUDOS (RECAUDOS_JEFE / RECAUDO_ASIST) se crea además la
 * fila del ejecutivo en FINANCIEROS_EQUIP a partir de esa cuenta, enlazada por
 * `usuarioRolId` — mismo patrón que EQUIPO_COMERCIAL. Ese id es el que la
 * cartera ya usa como gestor (PAGOS_TITULARES.gestorRecaudo y
 * PEOPLE.gestorRecaudo = USUARIOS_ROLES._id). Las dos escrituras van en UNA
 * transacción: si falla la segunda no queda una cuenta de login huérfana.
 *
 * Permiso: MANTENIMIENTO.USUARIOS.CREAR_ROL (SUPER_ADMIN/ADMIN bypass).
 */
import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { ValidationError, ConflictError } from '@/lib/errors';
import { queryOne, withTransaction } from '@/lib/postgres';
import { generateTempPassword } from '@/lib/gen-password';
import crypto from 'crypto';

// Roles que NO se crean por esta vía (tienen su propia opción en la página).
const EXCLUDED_ROLES = new Set(['ESTUDIANTE', 'ADVISOR', 'COMERCIAL']);

// Roles del equipo de recaudos: además del login llevan ficha en FINANCIEROS_EQUIP.
const ROLES_RECAUDOS = new Set(['RECAUDOS_JEFE', 'RECAUDO_ASIST']);

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
  const esRecaudos = ROLES_RECAUDOS.has(rol.toUpperCase());

  // Monto mensual del ejecutivo de recaudos. Opcional: si no viene queda NULL y
  // se completa después. Solo se guarda para los roles de recaudos.
  let montomensual: number | null = null;
  if (esRecaudos && body?.montomensual !== undefined && body?.montomensual !== null && String(body.montomensual).trim() !== '') {
    const n = Number(String(body.montomensual).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(n) || n < 0) throw new ValidationError('El monto mensual debe ser un número mayor o igual a 0');
    montomensual = n;
  }

  // Vigencia del ejecutivo en el equipo + una fecha adicional libre. DATE puro
  // (YYYY-MM-DD, sin hora ni TZ) como el resto de fechas de contrato.
  const fecha = (v: unknown, campo: string): string | null => {
    const raw = String(v ?? '').trim();
    if (!raw) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ValidationError(`${campo} debe tener formato AAAA-MM-DD`);
    return raw;
  };
  const vigenstart = esRecaudos ? fecha(body?.vigenstart, 'La fecha de inicio de vigencia') : null;
  const vigenfinal = esRecaudos ? fecha(body?.vigenfinal, 'La fecha final de vigencia') : null;
  const fechaopcional = esRecaudos ? fecha(body?.fechaopcional, 'La fecha opcional') : null;
  if (vigenstart && vigenfinal && vigenfinal < vigenstart) {
    throw new ValidationError('La fecha final de vigencia no puede ser anterior a la de inicio');
  }

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

  // Login + (si aplica) ficha de recaudos en una sola transacción.
  const { inserted, equipo } = await withTransaction(async (client) => {
    const userRow = (await client.query(
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
    )).rows[0];

    if (!esRecaudos) return { inserted: userRow, equipo: null };

    const equipoRow = (await client.query(
      `INSERT INTO "FINANCIEROS_EQUIP" (
         "_id", "nombre", "apellido", "correo", "celular", "numberid",
         "plataforma", "rol", "montomensual", "vigenstart", "vigenfinal",
         "fechaopcional", "clave", "usuarioRolId",
         "activo", "_createdDate", "_updatedDate"
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14,
         true, NOW(), NOW()
       )
       RETURNING "_id", "nombre", "correo", "rol", "montomensual",
                 "vigenstart", "vigenfinal", "fechaopcional", "usuarioRolId"`,
      [
        'feq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
        nombre, apellido, email, celular, numberid,
        plataforma, rol, montomensual, vigenstart, vigenfinal,
        fechaopcional, password, newId,
      ],
    )).rows[0];

    return { inserted: userRow, equipo: equipoRow };
  });

  return successResponse({ user: inserted, equipoRecaudos: equipo, generatedPassword: password });
});
