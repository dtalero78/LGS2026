import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * Auditoría de cambios de PEOPLE.aprobacion (tabla APROBACION_AUDIT, solo INSERT).
 * La tabla la crea scripts/create-aprobacion-audit.js (sin DDL en el request path).
 *
 * Registrar es BEST-EFFORT: si la tabla no existe o el INSERT falla, se loguea y
 * NO se rompe la operación de negocio (el cambio de estado ya se hizo).
 */

export type OrigenAprobacion =
  | 'FICHA_ESTADO_TITULAR'   // selector "Estado del Titular" en /person/[id]
  | 'APROBAR'                // POST /people/[id]/approve (botón Aprobar / selector → Aprobado)
  | 'APROBAR_CASCADA'        // beneficiarios aprobados al aprobar el titular, o titular auto-aprobado
  | 'PANTALLA_APROBACION'    // PUT /approvals/[id] (/dashboard/aprobacion)
  | 'WIX_LEGACY'             // POST /wix/updateTitularEstado
  | 'SISTEMA';               // procesos automáticos

export interface CambioAprobacion {
  personId: string;
  contrato?: string | null;
  tipoUsuario?: string | null;
  nombre?: string | null;
  estadoAnterior?: string | null;
  estadoNuevo: string | null;
  origen: OrigenAprobacion;
  motivo?: string | null;
  /** Sesión de NextAuth (o null si lo hace el sistema). */
  session?: any;
  /** Actor explícito cuando no hay sesión (p. ej. 'sistema'). */
  actor?: string | null;
}

export async function registrarCambioAprobacion(c: CambioAprobacion): Promise<void> {
  const anterior = (c.estadoAnterior ?? '') || null;
  const nuevo = (c.estadoNuevo ?? '') || null;
  if (anterior === nuevo) return; // no hubo cambio real
  const u = c.session?.user as any;
  try {
    await query(
      `INSERT INTO "APROBACION_AUDIT"
         ("_id","personId","contrato","tipoUsuario","nombre","estadoAnterior","estadoNuevo",
          "origen","motivo","usuarioEmail","usuarioNombre","usuarioRol","_createdDate")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
      [
        ids.audit(),
        c.personId, c.contrato ?? null, c.tipoUsuario ?? null, c.nombre ?? null,
        anterior, nuevo, c.origen, (c.motivo || '').trim() || null,
        u?.email ?? c.actor ?? null, u?.name ?? null, u?.role ?? null,
      ]
    );
  } catch (err: any) {
    console.warn('⚠️ [aprobacion-audit] no se pudo registrar el cambio:', err?.message || err);
  }
}

/** Historial de cambios de aprobación de un contrato (titular + beneficiarios), más reciente primero. */
export async function listarAuditoriaContrato(contrato: string, limit = 100) {
  try {
    return await queryMany(
      `SELECT "_id","personId","tipoUsuario","nombre","estadoAnterior","estadoNuevo","origen",
              "motivo","usuarioEmail","usuarioNombre","usuarioRol","_createdDate"
         FROM "APROBACION_AUDIT"
        WHERE "contrato" = $1
        ORDER BY "_createdDate" DESC
        LIMIT $2`,
      [contrato, limit]
    );
  } catch (err: any) {
    // Tabla aún no creada → historial vacío (no rompe la ficha).
    console.warn('⚠️ [aprobacion-audit] lectura falló:', err?.message || err);
    return [];
  }
}

/**
 * Regla "Aprobado → Pendiente" (revertir la aprobación). Solo se permite con el
 * contrato FRESCO: dentro del mes desde el inicio (inicioContrato, fallback
 * fechaContrato) Y ningún beneficiario avanzó de WELCOME. Basta que una falle
 * para bloquear. Usada por PATCH /people/[id] y PUT /approvals/[id].
 */
export async function assertPuedeRevertirAPendiente(p: {
  contrato: string | null;
  inicioContrato: string | Date | null;
  fechaContrato: string | Date | null;
}): Promise<void> {
  const baseFecha = p.inicioContrato || p.fechaContrato;
  const inicio = baseFecha ? new Date(baseFecha) : null;
  let dentroDelMes = false;
  if (inicio && !Number.isNaN(inicio.getTime())) {
    const limite = new Date(inicio.getTime());
    limite.setMonth(limite.getMonth() + 1);
    dentroDelMes = Date.now() < limite.getTime();
  }
  let benefProgreso = 0;
  if (p.contrato) {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM "ACADEMICA" a
         JOIN "PEOPLE" b ON b."numeroId" = a."numeroId" AND b."tipoUsuario" = 'BENEFICIARIO'
        WHERE b."contrato" = $1
          AND a."nivel" IS NOT NULL AND TRIM(a."nivel") <> '' AND UPPER(TRIM(a."nivel")) <> 'WELCOME'`,
      [p.contrato]
    );
    benefProgreso = parseInt(row?.count ?? '0', 10) || 0;
  }
  if (!dentroDelMes || benefProgreso > 0) {
    const motivos: string[] = [];
    if (!dentroDelMes) motivos.push('ya pasó un mes desde el inicio del contrato');
    if (benefProgreso > 0) motivos.push(`${benefProgreso} beneficiario(s) ya avanzaron de WELCOME`);
    throw new ValidationError(
      `No se puede pasar a "Pendiente": ${motivos.join(' y ')}. ` +
      `Solo se puede revertir mientras el contrato esté dentro del mes de inicio y los beneficiarios sigan en WELCOME o sin nivel.`
    );
  }
}

/** Nombre legible "Primer Apellido" de una fila PEOPLE. */
export function nombreDe(p: any): string | null {
  const n = [p?.primerNombre, p?.primerApellido].filter(Boolean).join(' ').trim();
  return n || null;
}
