import 'server-only';
import { query, queryOne, queryMany, withTransaction } from '@/lib/postgres';
import { kidsIntake } from '@/lib/kids-intake';

/**
 * Efectos de INACTIVAR / REACTIVAR a una persona (botón Inactivar del
 * beneficiario y toggle del contrato en la ficha), además de PEOPLE:
 *
 *  - Clases futuras: al inactivar se CANCELAN (cancelo=true) y se libera su cupo.
 *  - Ficha ACADEMICA y login: se tocan solo si la persona NO sigue estudiando por
 *    otro contrato vivo (re-matrícula con el mismo documento).
 *  - Login: se bloquea solo el de rol ESTUDIANTE y solo si el correo NO lo usa
 *    otro beneficiario activo (hermanos con el correo del papá/mamá); si es
 *    compartido no se bloquea y se avisa.
 *  - Kids: se pausa / reactiva su contrato en KIDS2026.
 */

const N = (c: string) => `UPPER(REGEXP_REPLACE(COALESCE(${c},''), '[.[:space:]_-]', '', 'g'))`;

/** Beneficiario vivo: activo, no finalizado/anulado/retractado. */
const VIVO = `p."tipoUsuario" = 'BENEFICIARIO'
  AND p."estadoInactivo" IS NOT TRUE
  AND UPPER(TRIM(COALESCE(p."estado",''))) NOT IN ('FINALIZADA','ANULADO','RETRACTADO')
  AND COALESCE(p."aprobacion",'') NOT IN ('Contrato nulo','Devuelto','Rechazado','Retractado')`;

/** ¿La misma persona (documento) sigue como beneficiaria viva en OTRO registro? */
async function sigueEstudiandoEnOtro(person: any): Promise<boolean> {
  if (!person?.numeroId) return false;
  const r = await queryOne(
    `SELECT 1 FROM "PEOPLE" p WHERE ${N('p."numeroId"')} = ${N('$1')} AND p."_id" <> $2 AND ${VIVO} LIMIT 1`,
    [person.numeroId, person._id]);
  return !!r;
}

/** ¿Otro beneficiario activo (otra persona) usa el mismo correo de login? */
async function correoCompartido(person: any): Promise<string | null> {
  if (!person?.email) return null;
  const r = await queryOne<{ nombre: string }>(
    `SELECT TRIM(CONCAT_WS(' ', p."primerNombre", p."primerApellido")) AS nombre FROM "PEOPLE" p
      WHERE LOWER(TRIM(p."email")) = LOWER(TRIM($1)) AND p."_id" <> $2
        AND ${N('p."numeroId"')} <> ${N('$3')} AND ${VIVO} LIMIT 1`,
    [person.email, person._id, person.numeroId || '']);
  return r ? (r.nombre || 'otro beneficiario') : null;
}

/** Ids con los que el alumno aparece en ACADEMICA_BOOKINGS (PEOPLE._id + sus ACADEMICA._id). */
async function idsDeReserva(person: any): Promise<string[]> {
  const acad = person?.numeroId
    ? await queryMany<{ _id: string }>(`SELECT "_id" FROM "ACADEMICA" WHERE ${N('"numeroId"')} = ${N('$1')}`, [person.numeroId])
    : [];
  return [person._id, ...acad.map(a => a._id)];
}

async function clasesFuturas(ids: string[]): Promise<{ _id: string; evId: string | null }[]> {
  return queryMany(
    `SELECT "_id", COALESCE("eventoId","idEvento") AS "evId" FROM "ACADEMICA_BOOKINGS"
      WHERE ("studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[]))
        AND "fechaEvento" > NOW() AND "cancelo" IS NOT TRUE`, [ids]);
}

/** Lo que pasaría al inactivar (para el modal de confirmación). */
export async function previewInactivacion(person: any) {
  const otro = await sigueEstudiandoEnOtro(person);
  const futuras = otro ? [] : await clasesFuturas(await idsDeReserva(person));
  const compartido = otro ? null : await correoCompartido(person);
  return {
    sigueEnOtroContrato: otro,
    clasesFuturas: futuras.length,
    correoCompartidoCon: compartido,
    esKids: person?.kids === true && person?.tipoUsuario === 'BENEFICIARIO',
  };
}

export interface ResultadoEfectos {
  clasesCanceladas: number;
  login: 'BLOQUEADO' | 'REACTIVADO' | 'COMPARTIDO_NO_BLOQUEADO' | 'SIGUE_EN_OTRO_CONTRATO' | 'SIN_CORREO';
  correoCompartidoCon?: string | null;
  kids?: { aplicado: boolean; estado?: string; detalle?: string; error?: string } | null;
}

/** Cancela las clases futuras y libera sus cupos (transacción). */
async function cancelarClasesFuturas(person: any): Promise<number> {
  const ids = await idsDeReserva(person);
  return withTransaction(async (client) => {
    const r = await client.query(
      `UPDATE "ACADEMICA_BOOKINGS" SET "cancelo" = true, "_updatedDate" = NOW()
        WHERE ("studentId" = ANY($1::text[]) OR "idEstudiante" = ANY($1::text[]))
          AND "fechaEvento" > NOW() AND "cancelo" IS NOT TRUE
        RETURNING COALESCE("eventoId","idEvento") AS "evId"`, [ids]);
    for (const row of r.rows as { evId: string | null }[]) {
      if (row.evId) {
        await client.query(
          `UPDATE "CALENDARIO" SET "inscritos" = GREATEST(COALESCE("inscritos",0) - 1, 0), "_updatedDate" = NOW() WHERE "_id" = $1`,
          [row.evId]);
      }
    }
    return r.rowCount || 0;
  });
}

/** Pausa / reactiva al kid en KIDS2026 (best-effort, nunca rompe la suspensión en LGS). */
async function sincronizarKids(person: any, inactivar: boolean, motivo: string) {
  if (!(person?.kids === true && person?.tipoUsuario === 'BENEFICIARIO') || !kidsIntake.isConfigured()) return null;
  const insc = await queryOne<{ kidsExternalRef: string | null }>(
    `SELECT "kidsExternalRef" FROM "KIDS_INSCRIPCIONES"
      WHERE "beneficiarioId" = $1 AND "enviadoAKids" = true AND "kidsExternalRef" IS NOT NULL
      ORDER BY "_createdDate" DESC LIMIT 1`, [person._id]);
  if (!insc?.kidsExternalRef) return { aplicado: false, detalle: 'Sin reserva en KIDS' };
  try {
    const r = inactivar
      ? await kidsIntake.suspendReservation(insc.kidsExternalRef, motivo)
      : await kidsIntake.reactivateReservation(insc.kidsExternalRef);
    return { aplicado: r.aplicado, estado: r.estado, detalle: (r as any).motivo };
  } catch (e: any) {
    console.error('[suspension] KIDS falló:', e?.message);
    return { aplicado: false, error: String(e?.message || 'error') };
  }
}

/** Efectos de INACTIVAR (después de marcar PEOPLE). */
export async function efectosInactivacion(person: any, motivo: string): Promise<ResultadoEfectos> {
  const kids = await sincronizarKids(person, true, motivo);
  if (await sigueEstudiandoEnOtro(person)) {
    return { clasesCanceladas: 0, login: 'SIGUE_EN_OTRO_CONTRATO', kids };
  }
  const clasesCanceladas = await cancelarClasesFuturas(person);
  if (person.numeroId) {
    await query(`UPDATE "ACADEMICA" SET "estadoInactivo" = true, "_updatedDate" = NOW() WHERE ${N('"numeroId"')} = ${N('$1')}`, [person.numeroId]);
  }
  if (!person.email) return { clasesCanceladas, login: 'SIN_CORREO', kids };
  const compartido = await correoCompartido(person);
  if (compartido) return { clasesCanceladas, login: 'COMPARTIDO_NO_BLOQUEADO', correoCompartidoCon: compartido, kids };
  await query(
    `UPDATE "USUARIOS_ROLES" SET "activo" = false, "_updatedDate" = NOW()
      WHERE LOWER("email") = LOWER($1) AND UPPER(COALESCE("rol",'')) = 'ESTUDIANTE'`, [person.email]);
  return { clasesCanceladas, login: 'BLOQUEADO', kids };
}

/** Efectos de REACTIVAR (después de marcar PEOPLE). */
export async function efectosReactivacion(person: any): Promise<ResultadoEfectos> {
  const kids = await sincronizarKids(person, false, '');
  if (person.numeroId) {
    await query(`UPDATE "ACADEMICA" SET "estadoInactivo" = false, "_updatedDate" = NOW() WHERE ${N('"numeroId"')} = ${N('$1')}`, [person.numeroId]);
  }
  if (!person.email) return { clasesCanceladas: 0, login: 'SIN_CORREO', kids };
  await query(
    `UPDATE "USUARIOS_ROLES" SET "activo" = true, "_updatedDate" = NOW()
      WHERE LOWER("email") = LOWER($1) AND UPPER(COALESCE("rol",'')) = 'ESTUDIANTE'`, [person.email]);
  return { clasesCanceladas: 0, login: 'REACTIVADO', kids };
}
