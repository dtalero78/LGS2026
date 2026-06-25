import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { MantenimientoPermission } from '@/types/permissions';
import { query, queryOne } from '@/lib/postgres';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';

/**
 * GET/PATCH /api/postgres/advisors/[id]
 *
 * Edición de los datos de un advisor (los mismos que captura /nuevo-advisor),
 * usada por el modal de /admin/lgs-buckets. Los datos viven en dos tablas:
 *   - ADVISORS: primerNombre, primerApellido, email, zoom, telefono, pais,
 *               domicilioadvisor, fechaNacimiento
 *   - USUARIOS_ROLES: numberid (numeroId), celular, password (clave)
 *
 * La foto NO se edita aquí — tiene su propio botón "Reemplazar" en la card.
 *
 * GET   gated por MANTENIMIENTO.LGS_BUCKETS.VER
 * PATCH gated por MANTENIMIENTO.LGS_BUCKETS.EDITAR
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Resuelve el USUARIOS_ROLES vinculado al advisor (usuarioRolId → email). */
async function findUsuarioRol(advisor: { usuarioRolId?: string | null; email?: string | null }) {
  if (advisor.usuarioRolId) {
    const byId = await queryOne<any>(
      `SELECT "_id","email","numberid","celular" FROM "USUARIOS_ROLES" WHERE "_id" = $1 LIMIT 1`,
      [advisor.usuarioRolId]
    );
    if (byId) return byId;
  }
  if (advisor.email) {
    return queryOne<any>(
      `SELECT "_id","email","numberid","celular" FROM "USUARIOS_ROLES"
        WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) LIMIT 1`,
      [advisor.email]
    );
  }
  return null;
}

export const GET = handlerWithAuth(async (_req, ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LGS_BUCKETS);
  const id = ctx.params.id;

  const adv = await queryOne<any>(
    `SELECT "_id","primerNombre","primerApellido","nombreCompleto","email","zoom",
            "telefono","pais","domicilioadvisor","fechaNacimiento","fotoAdvisor","usuarioRolId"
       FROM "ADVISORS" WHERE "_id" = $1 LIMIT 1`,
    [id]
  );
  if (!adv) throw new NotFoundError('Advisor', id);

  const ur = await findUsuarioRol(adv);

  return successResponse({
    advisor: {
      id: adv._id,
      primerNombre: adv.primerNombre || '',
      primerApellido: adv.primerApellido || '',
      email: adv.email || '',
      zoom: adv.zoom || '',
      telefono: adv.telefono || ur?.celular || '',
      pais: adv.pais || '',
      domicilio: adv.domicilioadvisor || '',
      fechaNacimiento: adv.fechaNacimiento ? String(adv.fechaNacimiento).slice(0, 10) : '',
      numeroId: ur?.numberid || '',
      tieneUsuarioRol: !!ur,
    },
  });
});

export const PATCH = handlerWithAuth(async (req, ctx, session) => {
  await requirePermission(session, MantenimientoPermission.LGS_BUCKETS_EDITAR);
  const id = ctx.params.id;
  const body = await req.json();

  const primerNombre = (body.primerNombre || '').trim();
  const primerApellido = (body.primerApellido || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  if (!primerNombre) throw new ValidationError('El primer nombre es requerido');
  if (!primerApellido) throw new ValidationError('El primer apellido es requerido');
  if (!email) throw new ValidationError('El email es requerido');
  if (!EMAIL_REGEX.test(email)) throw new ValidationError('El correo no es válido. Debe contener @ y un dominio, sin espacios');

  const adv = await queryOne<any>(
    `SELECT "_id","email","usuarioRolId" FROM "ADVISORS" WHERE "_id" = $1 LIMIT 1`,
    [id]
  );
  if (!adv) throw new NotFoundError('Advisor', id);
  const ur = await findUsuarioRol(adv);
  const urId: string = ur?._id || '__none__';

  const numeroIdNorm = body.numeroId?.trim().toUpperCase() || null;
  const zoomNorm = body.zoom?.trim() || null;
  const telefono = body.telefono?.trim() || null;
  const pais = body.pais?.trim() || null;
  const domicilio = body.domicilio?.trim() || null;
  const fechaNacimiento = body.fechaNacimiento?.trim() || null;
  const clave = (body.clave || '').trim();
  if (clave && /\s/.test(clave)) throw new ValidationError('La clave no puede contener espacios');
  if (clave && clave.length < 4) throw new ValidationError('La clave debe tener al menos 4 caracteres');

  // ── Validación de duplicados (excluyéndose a sí mismo) ──
  // 1) Email en ADVISORS
  const dupAdvEmail = await queryOne<{ nombreCompleto: string | null }>(
    `SELECT "nombreCompleto" FROM "ADVISORS"
      WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) AND "_id" <> $2 LIMIT 1`,
    [email, id]
  );
  if (dupAdvEmail) throw new ConflictError('Ya existe otro advisor registrado con ese correo');

  // 2) Email en USUARIOS_ROLES (excluyendo la cuenta del propio advisor)
  const dupUserEmail = await queryOne<{ rol: string; nombre: string | null }>(
    `SELECT "rol","nombre" FROM "USUARIOS_ROLES"
      WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) AND "_id" <> $2 LIMIT 1`,
    [email, urId]
  );
  if (dupUserEmail) {
    throw new ConflictError(
      `Ese correo ya está en uso por otro usuario (rol ${dupUserEmail.rol}${dupUserEmail.nombre ? ' — ' + dupUserEmail.nombre : ''})`
    );
  }

  // 3) Número de identificación en USUARIOS_ROLES
  if (numeroIdNorm) {
    const dupId = await queryOne<{ rol: string; nombre: string | null }>(
      `SELECT "rol","nombre" FROM "USUARIOS_ROLES"
        WHERE UPPER(TRIM("numberid")) = UPPER(TRIM($1)) AND "_id" <> $2 LIMIT 1`,
      [numeroIdNorm, urId]
    );
    if (dupId) {
      throw new ConflictError(
        `Ya existe un usuario con ese número de identificación (rol ${dupId.rol}${dupId.nombre ? ' — ' + dupId.nombre : ''})`
      );
    }
  }

  // 4) Link de Zoom único en ADVISORS
  if (zoomNorm) {
    const dupZoom = await queryOne<{ nombreCompleto: string | null }>(
      `SELECT "nombreCompleto" FROM "ADVISORS"
        WHERE TRIM("zoom") = TRIM($1) AND "_id" <> $2 LIMIT 1`,
      [zoomNorm, id]
    );
    if (dupZoom) {
      throw new ConflictError(
        `Ese link de Zoom ya está asignado a otro advisor${dupZoom.nombreCompleto ? ' (' + dupZoom.nombreCompleto + ')' : ''}`
      );
    }
  }

  const nombreCompleto = `${primerNombre} ${primerApellido}`;

  // ── Update ADVISORS ──
  await query(
    `UPDATE "ADVISORS"
        SET "primerNombre"     = $1,
            "primerApellido"   = $2,
            "nombreCompleto"   = $3,
            "email"            = $4,
            "zoom"             = $5,
            "telefono"         = $6,
            "pais"             = $7,
            "domicilioadvisor" = $8,
            "fechaNacimiento"  = $9,
            "_updatedDate"     = NOW()
      WHERE "_id" = $10`,
    [primerNombre, primerApellido, nombreCompleto, email, zoomNorm, telefono, pais, domicilio, fechaNacimiento, id]
  );

  // ── Update USUARIOS_ROLES (si existe la cuenta vinculada) ──
  // celular se sincroniza con telefono (mismo dato). password solo si se ingresó clave.
  if (ur?._id) {
    if (clave) {
      await query(
        `UPDATE "USUARIOS_ROLES"
            SET "email" = $1, "numberid" = $2, "nombre" = $3, "celular" = $4,
                "password" = $5, "_updatedDate" = NOW()
          WHERE "_id" = $6`,
        [email, numeroIdNorm, nombreCompleto, telefono, clave, ur._id]
      );
    } else {
      await query(
        `UPDATE "USUARIOS_ROLES"
            SET "email" = $1, "numberid" = $2, "nombre" = $3, "celular" = $4, "_updatedDate" = NOW()
          WHERE "_id" = $5`,
        [email, numeroIdNorm, nombreCompleto, telefono, ur._id]
      );
    }
  }

  return successResponse({ message: 'Advisor actualizado', nombre: nombreCompleto, email });
});
