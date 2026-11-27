import 'server-only';
import type { PoolClient } from 'pg';
import { query, queryMany, withTransaction } from '@/lib/postgres';
import { purgarContrato } from '@/lib/purgar-contrato';
import { liberarReservasKids } from '@/lib/kids-baja';
import { contarClasesPropias } from '@/lib/libro-depuracion';
import { registrarEventoContrato } from '@/lib/contrato-eventos';
import { ValidationError } from '@/lib/errors';

/**
 * Libro de Producción › Papelera (acordado 2026-11-26).
 *
 * Un contrato pasa a la Papelera (PEOPLE.papeleraEn en sus filas TITULAR) cuando:
 *   - está en la pestaña «Por resolver» (misma regla que `vistaDe()` de la página:
 *     no es Aprobado/Finalizado, Pendiente Comercial, Retractado ni Rechazado, y si no
 *     tiene estado le falta algún requisito — firma, documentos, recibo o PDF en Drive),
 *   - lleva PAPELERA_DIAS desde su creación (o desde que se restauró: papeleraRestauradaEn),
 *   - no tiene pagos validados por Recaudos,
 *   - y sus personas no tienen clases propias (las compartidas con otro contrato no cuentan).
 * Firmado o no, da igual. Los Rechazados y los contratos CANJE (pestaña propia) nunca entran.
 *
 * Cron diario (/api/cron/papelera-libro): 1) devuelve lo que ya no cumple la regla,
 * 2) envía lo que la cumple, 3) borra lo que lleva BORRADO_DIAS en la Papelera
 * (purgarContrato, copia en PURGE_LOG tipo PAPELERA_AUTO, libera reservas KIDS).
 * Desde la pestaña: Restaurar (15 días más de gracia) y Borrar (PURGE_LOG tipo PAPELERA).
 */
export const PAPELERA_DIAS = 15;
export const BORRADO_DIAS = 30;

/** El titular `p` cumple todos los requisitos de «Listo para aprobación». */
const COMPLETO_SQL = `(COALESCE(p."hashConsentimiento",'') <> ''
  AND (CASE WHEN jsonb_typeof(p."documentacion") = 'array' THEN jsonb_array_length(p."documentacion") ELSE 0 END) > 0
  AND p."reciboInscripcion" IS NOT NULL
  AND COALESCE(p."driveFileId",'') <> '')`;
const APROB = `LOWER(TRIM(COALESCE(p."aprobacion",'')))`;
/** El titular `p` cae en la pestaña «Por resolver» (espejo de vistaDe() de la página del Libro). */
export const POR_RESOLVER_SQL = `(UPPER(COALESCE(p."tipoContrato",'')) <> 'CANJE'
  AND ${APROB} !~ '^(aprobad|finaliz)'
  AND ${APROB} NOT IN ('pendiente comercial','retractado','rechazado')
  AND NOT (${APROB} IN ('','pendiente') AND ${COMPLETO_SQL}))`;
/** Ninguna persona del contrato de `p` tiene un pago validado. */
const SIN_PAGOS_VALIDADOS_SQL = `NOT EXISTS (
  SELECT 1 FROM "PAGOS_TITULARES" pt JOIN "PEOPLE" x ON x."_id" = pt."idPeople"
   WHERE x."contrato" = p."contrato" AND pt."validado" IS TRUE)`;

/** Un titular por contrato (mismo criterio del Libro: prefiere el firmado y con estado). */
const TITULARES_SQL = (where: string) => `
  SELECT DISTINCT ON (p."contrato") p."_id", p."contrato", p."papeleraEn"
    FROM "PEOPLE" p
   WHERE p."tipoUsuario" = 'TITULAR' AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'
     AND ${where}
   ORDER BY p."contrato", (COALESCE(p."hashConsentimiento",'') <> '') DESC, (p."aprobacion" IS NOT NULL) DESC, p."_createdDate" ASC`;

async function marcar(contrato: string, enPapelera: boolean) {
  await query(
    enPapelera
      ? `UPDATE "PEOPLE" SET "papeleraEn" = NOW(), "_updatedDate" = NOW()
          WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' AND "papeleraEn" IS NULL`
      : `UPDATE "PEOPLE" SET "papeleraEn" = NULL, "papeleraRestauradaEn" = NOW(), "_updatedDate" = NOW()
          WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' AND "papeleraEn" IS NOT NULL`,
    [contrato]);
}

/** Contratos que hoy cumplen la regla para entrar a la Papelera (aún fuera de ella). */
export async function candidatosPapelera(): Promise<{ _id: string; contrato: string }[]> {
  const filas = await queryMany<any>(TITULARES_SQL(`p."papeleraEn" IS NULL
     AND ${POR_RESOLVER_SQL}
     AND COALESCE(p."papeleraRestauradaEn", p."fechaCreacion", p."_createdDate") <= NOW() - INTERVAL '${PAPELERA_DIAS} days'
     AND ${SIN_PAGOS_VALIDADOS_SQL}`));
  const out: { _id: string; contrato: string }[] = [];
  for (const f of filas) if ((await contarClasesPropias(f.contrato)) === 0) out.push(f);
  return out;
}

/** ¿El contrato (de la fila titular `id`) sigue cumpliendo la regla de la Papelera? (sin mirar los días) */
async function sigueEnRegla(contrato: string): Promise<boolean> {
  const ok = await queryMany<any>(TITULARES_SQL(`p."contrato" = $1`) , [contrato]);
  if (!ok.length) return false;
  const r = await queryMany<any>(
    `SELECT 1 FROM "PEOPLE" p WHERE p."_id" = $1 AND ${POR_RESOLVER_SQL} AND ${SIN_PAGOS_VALIDADOS_SQL}`, [ok[0]._id]);
  return r.length > 0 && (await contarClasesPropias(contrato)) === 0;
}

const evento = (titularId: string, accion: string, detalle: string, session?: any) =>
  registrarEventoContrato({ personaId: titularId, categoria: 'APROBACION', accion, detalle, session, actor: session ? null : 'sistema' })
    .catch(() => {});

/** Borra un contrato de la Papelera (revalida la regla con la fila bloqueada). */
async function borrarContrato(contrato: string, o: {
  tipoPurga: 'PAPELERA' | 'PAPELERA_AUTO'; motivo: string; actorEmail: string; actorNombre: string | null; ip: string; userAgent: string;
}): Promise<'ok' | 'no_aplica' | 'kids'> {
  if (!(await sigueEnRegla(contrato))) return 'no_aplica';
  const kids = await liberarReservasKids({ contrato }, 'ANULADO', `Borrado desde la Papelera del Libro de Producción: ${o.motivo}`);
  if (kids.errores > 0) return 'kids';
  const res = await withTransaction((client: PoolClient) => purgarContrato(client, contrato, {
    tipoPurga: o.tipoPurga,
    motivo: `[Libro de Producción · Papelera${o.tipoPurga === 'PAPELERA_AUTO' ? ' · automático' : ''}] ${o.motivo}`,
    actorEmail: o.actorEmail, actorNombre: o.actorNombre, ip: o.ip, userAgent: o.userAgent,
    verificar: async (c, t) => !!(await c.query(
      `SELECT 1 FROM "PEOPLE" p WHERE p."_id" = $1 AND p."papeleraEn" IS NOT NULL AND ${POR_RESOLVER_SQL}`, [t._id])).rowCount,
  }));
  return res.status === 'ok' ? 'ok' : 'no_aplica';
}

// ── Cron diario ───────────────────────────────────────────────────────────────

export async function procesarPapeleraCron() {
  // 1) Devolver lo que ya no cumple la regla (se completó, se aprobó, cambió de estado,
  //    tiene pagos validados o clases). Quedan con papeleraRestauradaEn = hoy.
  const dentro = await queryMany<any>(TITULARES_SQL(`p."papeleraEn" IS NOT NULL`));
  let devueltos = 0;
  for (const t of dentro) {
    if (await sigueEnRegla(t.contrato)) continue;
    await marcar(t.contrato, false);
    await evento(t._id, 'Devuelto de la Papelera', 'El contrato ya no cumple la regla de la Papelera del Libro de Producción (se completó, cambió de estado, tiene pagos validados o clases).');
    devueltos++;
  }

  // 2) Enviar lo que cumple la regla.
  const nuevos = await candidatosPapelera();
  for (const t of nuevos) {
    await marcar(t.contrato, true);
    await evento(t._id, 'Enviado a la Papelera',
      `Lleva ${PAPELERA_DIAS} días o más en «Por resolver» sin pagos validados ni clases; se borrará en ${BORRADO_DIAS} días si sigue así.`);
  }

  // 3) Borrar lo que lleva BORRADO_DIAS en la Papelera.
  const vencidos = await queryMany<any>(TITULARES_SQL(
    `p."papeleraEn" IS NOT NULL AND p."papeleraEn" <= NOW() - INTERVAL '${BORRADO_DIAS} days'`));
  let borrados = 0; const omitidos: string[] = [];
  for (const t of vencidos) {
    try {
      const r = await borrarContrato(t.contrato, {
        tipoPurga: 'PAPELERA_AUTO', motivo: `${BORRADO_DIAS} días en la Papelera`,
        actorEmail: 'sistema', actorNombre: 'Cron papelera-libro', ip: '', userAgent: 'cron',
      });
      if (r === 'ok') borrados++; else omitidos.push(`${t.contrato} (${r})`);
    } catch (e: any) {
      omitidos.push(`${t.contrato} (error: ${e?.message})`);
    }
  }
  return { devueltos, enviados: nuevos.length, borrados, omitidos };
}

// ── Acciones manuales (pestaña Papelera) ─────────────────────────────────────

async function contratosEnPapelera(titularIds: string[]): Promise<{ _id: string; contrato: string }[]> {
  const ids = Array.from(new Set((titularIds || []).map(String).filter(Boolean)));
  if (!ids.length) throw new ValidationError('Selecciona al menos un contrato');
  if (ids.length > 100) throw new ValidationError('Máximo 100 contratos por operación');
  return queryMany<any>(
    `SELECT DISTINCT ON ("contrato") "_id", "contrato" FROM "PEOPLE"
      WHERE "_id" = ANY($1::text[]) AND "tipoUsuario" = 'TITULAR' AND "papeleraEn" IS NOT NULL
      ORDER BY "contrato"`, [ids]);
}

export async function restaurarDePapelera(titularIds: string[], session: any) {
  const filas = await contratosEnPapelera(titularIds);
  for (const t of filas) {
    await marcar(t.contrato, false);
    await evento(t._id, 'Restaurado de la Papelera',
      `Vuelve a «Por resolver»; tiene ${PAPELERA_DIAS} días más antes de volver a la Papelera.`, session);
  }
  return { restaurados: filas.map(f => f.contrato) };
}

export async function borrarDePapelera(titularIds: string[], motivo: string, session: any, req: { ip: string; userAgent: string }) {
  const m = String(motivo || '').trim();
  if (m.length < 10) throw new ValidationError('Escribe el motivo del borrado (mínimo 10 caracteres)');
  const filas = await contratosEnPapelera(titularIds);
  const borrados: string[] = []; const omitidos: { contrato: string; razon: string }[] = [];
  for (const t of filas) {
    const r = await borrarContrato(t.contrato, {
      tipoPurga: 'PAPELERA', motivo: m,
      actorEmail: session?.user?.email ?? 'desconocido', actorNombre: session?.user?.name ?? null,
      ip: req.ip, userAgent: req.userAgent,
    });
    if (r === 'ok') borrados.push(t.contrato);
    else omitidos.push({ contrato: t.contrato, razon: r === 'kids' ? 'KIDS no respondió al liberar las reservas' : 'Ya no cumple la regla (pagos validados, clases o cambió de estado)' });
  }
  return { borrados, omitidos };
}
