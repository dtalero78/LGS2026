import 'server-only';
import { query, queryMany, queryOne } from '@/lib/postgres';
import { kidsIntake, type EstadoFacturaKids, type KidsFacturaGuia } from '@/lib/kids-intake';
import { subirFactura, listarCortes } from '@/services/liq-flujo.service';
import type { Corte } from '@/services/liquidacion-advisors.service';

/**
 * Facturas de guías Kids (fase 2). La guía la SUBE EN KIDS ("Mis horas y facturas");
 * LGS la toma desde KIDS y la pasa por el mismo flujo de Gestión Advisors que cualquier
 * factura (lectura con IA, inconsistencias, devolver, verificar, pagar). Cada cambio de
 * estado se le devuelve a KIDS para que la guía lo vea.
 *
 * Entrada: KIDS avisa al subir (POST /api/kids-sync/factura-guia) y el cron
 * `sync-guias-kids` recoge cada 15 min las que hayan quedado pendientes.
 * La factura en LGS guarda el id de KIDS en LIQ_ADVISOR_FACTURAS."kidsFacturaId".
 */

export interface ResultadoFacturaKids { id: string; estado: EstadoFacturaKids; motivo?: string; lgsFacturaId?: string }

/** Toma UNA factura de KIDS: la copia al flujo de LGS y le informa a KIDS el resultado. */
async function tomarFactura(f: KidsFacturaGuia): Promise<ResultadoFacturaKids> {
  const ya = await queryOne<{ _id: string }>(`SELECT "_id" FROM "LIQ_ADVISOR_FACTURAS" WHERE "kidsFacturaId" = $1`, [f.id]);
  if (ya) {
    await kidsIntake.estadoFacturaGuia(f.id, { estado: 'RECIBIDA', lgsFacturaId: ya._id }).catch(() => {});
    return { id: f.id, estado: 'RECIBIDA', lgsFacturaId: ya._id };
  }
  let res: ResultadoFacturaKids;
  try {
    const adv = await queryOne<any>(
      `SELECT a."_id", u."email", COALESCE(NULLIF(TRIM(a."nombreCompleto"),''), u."nombre") AS nombre
         FROM "ADVISORS" a LEFT JOIN "USUARIOS_ROLES" u ON u."_id" = a."usuarioRolId"
        WHERE a."kidsUserId" = $1 LIMIT 1`, [f.guiaUserId]);
    if (!adv) throw new Error('La guía aún no está registrada en LGS. Intente de nuevo en unos minutos.');
    const archivo = await kidsIntake.archivoFacturaGuia(f.id);
    const r = await subirFactura(
      { advisorId: adv._id, programa: 'KIDS', periodo: f.periodo, corte: f.corte as Corte, archivo: { buf: archivo.bytes, tipo: archivo.mime, nombre: f.nombre } },
      { email: adv.email || `kids:${f.username}`, nombre: adv.nombre || f.username, rol: 'GUIA_KIDS' },
      { esAdvisor: true });
    await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "kidsFacturaId" = $2 WHERE "_id" = $1`, [r.id, f.id]);
    res = { id: f.id, estado: 'RECIBIDA', lgsFacturaId: r.id };
  } catch (e: any) {
    // Regla de negocio (plazo vencido, corte verificado, sin horas…): la guía ve el motivo en KIDS.
    res = { id: f.id, estado: 'RECHAZADA', motivo: String(e?.message || 'No se pudo recibir la factura').slice(0, 500) };
  }
  await kidsIntake.estadoFacturaGuia(f.id, { estado: res.estado, motivo: res.motivo ?? null, lgsFacturaId: res.lgsFacturaId ?? null })
    .catch((e) => console.warn('[kids-facturas] no se pudo informar a KIDS', f.id, e?.message));
  return res;
}

/** Recoge las facturas pendientes de KIDS (todas o solo `soloId`). Nunca lanza por una factura. */
export async function tomarFacturasKids(soloId?: string): Promise<ResultadoFacturaKids[]> {
  if (!kidsIntake.isConfigured()) return [];
  const { facturas } = await kidsIntake.facturasGuiasPendientes();
  const out: ResultadoFacturaKids[] = [];
  for (const f of (facturas || []).filter((x) => !soloId || x.id === soloId)) out.push(await tomarFactura(f));
  return out;
}

/**
 * Devuelve a KIDS el estado de las facturas de un corte (best-effort, nunca frena la
 * operación de LGS). Se llama tras devolver, verificar, pagar o reabrir.
 */
export async function avisarEstadoFacturasKids(liqId: string | null, estado: EstadoFacturaKids, motivo?: string | null): Promise<void> {
  if (!liqId || !kidsIntake.isConfigured()) return;
  try {
    const filas = await queryMany<{ _id: string; kidsFacturaId: string }>(
      `SELECT "_id", "kidsFacturaId" FROM "LIQ_ADVISOR_FACTURAS"
        WHERE "liqId" = $1 AND "kidsFacturaId" IS NOT NULL AND "estado" <> 'REEMPLAZADA'
        ORDER BY "subidoEn" DESC LIMIT 1`, [liqId]);
    for (const f of filas) {
      await kidsIntake.estadoFacturaGuia(f.kidsFacturaId, { estado, motivo: motivo ?? null, lgsFacturaId: f._id });
    }
  } catch (e: any) {
    console.warn('[kids-facturas] aviso de estado a KIDS falló:', e?.message);
  }
}

/**
 * Cortes Kids de una guía (por su usuario de KIDS) para su pantalla "Mis horas y facturas"
 * en KIDS: horas, estado, plazo y su factura. SIN valores ($): la guía solo ve horas.
 */
export async function cortesDeGuia(kidsUserId: string, periodo: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw new Error('Periodo inválido (AAAA-MM).');
  const adv = await queryOne<{ _id: string; nombre: string; pais: string | null; tipoContratacion: string | null }>(
    `SELECT "_id", COALESCE(NULLIF(TRIM("nombreCompleto"),''), "primerNombre") AS nombre, "pais", "tipoContratacion"
       FROM "ADVISORS" WHERE "kidsUserId" = $1 LIMIT 1`, [kidsUserId]);
  if (!adv) return { registrada: false as const, cortes: [] };
  const cortes = (await listarCortes(periodo, undefined, adv._id)).filter((c) => c.programa === 'KIDS');
  return {
    registrada: true as const,
    pais: adv.pais, tipoContratacion: adv.tipoContratacion,
    cortes: cortes.map((c) => ({
      corte: c.corte, estado: c.estado, requiereFactura: c.requiereFactura, horas: c.horas,
      plazo: c.plazo, plazoReenvio: c.plazoReenvio, horasOk: c.horasOk,
      pagadoEn: c.pagadoEn, referenciaPago: c.referenciaPago,
      factura: c.factura ? {
        nombre: c.factura.nombre, estado: c.factura.estado, subidoEn: c.factura.subidoEn,
        comentarioDevolucion: c.factura.comentarioDevolucion, devueltaEn: c.factura.devueltaEn,
      } : null,
    })),
  };
}
