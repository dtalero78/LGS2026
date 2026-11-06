/**
 * Administración › Gestión Advisors — flujo de cada corte (Fase 4).
 *
 * Unidad = advisor × programa (LGS/KIDS) × corte (Colombia Q1/Q2; Chile y Ecuador MES).
 * Estados (docs/specs/gestion-advisors.md §1.8):
 *   ABIERTO → FACTURA_RECIBIDA → VERIFICADO → PAGADO
 *                ↓ ↑ reenvío
 *             DEVUELTA
 *   ABIERTO sin factura al vencer el plazo → SIN_FACTURA (bloquea el pago de su grupo de país)
 *   PLANTA no factura: ABIERTO → VERIFICADO → PAGADO.  Por horas sin horas en el corte: SIN_HORAS.
 * Roles: ACADEMICO_JEFE ajusta y marca Horas OK · ADMINISTRACION devuelve / verifica ·
 * ADMINISTRACION_JEFE paga · solo SUPER_ADMIN reabre. Todo queda en LIQ_ADVISOR_LOG.
 * Plazo de factura: Q1 → día 20 del mes; Q2 y MES → día 5 del mes siguiente (hora local
 * del advisor); tras una devolución, 2 días más para reenviar.
 */

import 'server-only';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query, queryMany, queryOne } from '@/lib/postgres';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '@/lib/errors';
import { generateId } from '@/lib/id-generator';
import { spacesClient, SPACES_BUCKET } from '@/lib/spaces';
import { llamarOpenAIJson, archivoComoContenidoIA } from '@/services/recibo-extract.service';
import { calcularLiquidacion, type AdvisorLiq, type Corte, type Liquidacion } from '@/services/liquidacion-advisors.service';

export type EstadoCorte = 'ABIERTO' | 'FACTURA_RECIBIDA' | 'DEVUELTA' | 'SIN_FACTURA' | 'SIN_HORAS' | 'VERIFICADO' | 'PAGADO';
export const CONCEPTOS_AJUSTE = ['NORMAL', 'FESTIVO', 'EXAM_INTERN', 'SIN_ASISTENTES', 'EXTRA_AUTORIZADA', 'GESTION_ADMIN'] as const;

const TZ: Record<string, string> = { Chile: 'America/Santiago', Colombia: 'America/Bogota', Ecuador: 'America/Guayaquil' };
const hoyEn = (pais: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ[pais] || 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export interface Actor { email: string; nombre?: string | null; rol: string }

// ── Plazos ───────────────────────────────────────────────────────────────────

export function plazoFactura(periodo: string, corte: Corte): string {
  const [y, m] = periodo.split('-').map(Number);
  if (corte === 'Q1') return `${periodo}-20`;
  const sig = new Date(Date.UTC(y, m, 1));
  return `${sig.getUTCFullYear()}-${String(sig.getUTCMonth() + 1).padStart(2, '0')}-05`;
}

export function rangoCorte(periodo: string, corte: Corte): { desde: string; hasta: string } {
  const [y, m] = periodo.split('-').map(Number);
  const ult = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (corte === 'Q1') return { desde: `${periodo}-01`, hasta: `${periodo}-15` };
  if (corte === 'Q2') return { desde: `${periodo}-16`, hasta: `${periodo}-${ult}` };
  return { desde: `${periodo}-01`, hasta: `${periodo}-${ult}` };
}

const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86400e3).toISOString().slice(0, 10);

// ── Lectura ──────────────────────────────────────────────────────────────────

export interface FacturaInfo {
  _id: string; nombre: string | null; tipo: string | null; estado: string; subidoEn: string; subidoPor: string | null;
  /** Concepto que cobra: NORMAL | EXAM_INTERN | FESTIVO | OTRO (null = factura única de antes). */
  concepto: string | null;
  extraido: any; comentarioDevolucion: string | null; devueltaPor: string | null; devueltaEn: string | null;
  inconsistencias: string[];
}

/** Un corte admite hasta este número de facturas a la vez (p. ej. horas normales + Exam. Intern.). */
export const MAX_FACTURAS_CORTE = 3;
export const CONCEPTOS_FACTURA = ['NORMAL', 'EXAM_INTERN', 'FESTIVO', 'OTRO'] as const;
export interface AjusteInfo {
  _id: string; alcance: string; semanaInicio: string | null; concepto: string; horas: number; motivo: string;
  usuarioEmail: string | null; usuarioNombre: string | null; fecha: string;
}
export interface CorteInfo {
  liqId: string | null; advisorId: string; programa: 'LGS' | 'KIDS'; corte: Corte;
  estado: EstadoCorte; requiereFactura: boolean; plazo: string; plazoReenvio: string | null;
  horas: number; valor: number | null; moneda: string;
  horasOk: boolean; horasOkPor: string | null;
  verificadoPor: string | null; verificadoEn: string | null; pagadoPor: string | null; pagadoEn: string | null; referenciaPago: string | null;
  snapshot: any; cambioTrasVerificar: boolean;
  /** Factura más reciente del conjunto vigente; sus `inconsistencias` son las del CONJUNTO (sumas). */
  factura: FacturaInfo | null;
  /** Conjunto vigente: todas las facturas del corte que se revisan juntas (RECIBIDA/ACEPTADA, o las DEVUELTAS). */
  facturas: FacturaInfo[];
  ajustes: AjusteInfo[];
}

const clave = (advisorId: string, programa: string, corte: string) => `${advisorId}|${programa}|${corte}`;

/** Documento de identidad del advisor (USUARIOS_ROLES.numberid del login enlazado o por correo). */
async function documentosAdvisors(ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const rows = await queryMany<any>(
    `SELECT a."_id", COALESCE(ur."numberid", ue."numberid") AS doc
       FROM "ADVISORS" a
       LEFT JOIN "USUARIOS_ROLES" ur ON ur."_id" = a."usuarioRolId"
       LEFT JOIN LATERAL (SELECT "numberid" FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER(a."email") AND "numberid" IS NOT NULL LIMIT 1) ue ON true
      WHERE a."_id" = ANY($1::text[])`, [ids]);
  return new Map(rows.map((r) => [r._id, r.doc ? String(r.doc) : null]));
}

const soloDigitos = (s: any) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase();

/**
 * Compara el CONJUNTO de facturas del corte con la plataforma: cada una por separado
 * (emisor, fecha, que sea factura) y la SUMA de horas y de valor bruto contra lo calculado.
 * Así un advisor puede cobrar en dos facturas (p. ej. horas normales y Exam. Intern.).
 */
function inconsistenciasConjunto(facts: { nombre: string | null; extraido: any }[], corte: { periodo: string; corte: Corte; horas: number; valor: number | null }, doc: string | null): string[] {
  if (facts.length <= 1) return facts.length ? inconsistencias(facts[0].extraido, corte, doc) : [];
  const out: string[] = [];
  for (const f of facts) {
    const nombre = `«${f.nombre || 'factura'}»`;
    for (const i of inconsistencias(f.extraido, { ...corte, horas: NaN, valor: null }, doc)) out.push(`${nombre}: ${i}`);
  }
  const conHoras = facts.filter((f) => f.extraido?.horas !== null && f.extraido?.horas !== undefined);
  const sumaH = conHoras.reduce((t, f) => t + Number(f.extraido.horas), 0);
  if (conHoras.length && Math.abs(sumaH - corte.horas) > 0.01) {
    out.push(`Horas facturadas en total ${sumaH} (${facts.length} facturas) ≠ horas de la plataforma ${corte.horas}.`);
  }
  if (corte.valor !== null) {
    const sinBruto = facts.filter((f) => f.extraido?.bruto === null || f.extraido?.bruto === undefined);
    if (sinBruto.length) out.push(`No se leyó el valor bruto de ${sinBruto.map((f) => `«${f.nombre || 'factura'}»`).join(', ')}.`);
    else {
      const suma = facts.reduce((t, f) => t + Number(f.extraido.bruto), 0);
      if (Math.abs(suma - corte.valor) > Math.max(1, corte.valor * 0.01)) {
        out.push(`Valor bruto total ${suma.toLocaleString('es-CO')} (${facts.length} facturas) ≠ esperado ${corte.valor.toLocaleString('es-CO')} (horas × tarifa).`);
      }
    }
  }
  return out;
}

/** Compara lo leído de UNA factura con lo que dice la plataforma (horas NaN / valor null = no comparar totales). */
function inconsistencias(ext: any, corte: { periodo: string; corte: Corte; horas: number; valor: number | null }, doc: string | null): string[] {
  if (!ext) return ['No se pudo leer la factura con IA: revisar a mano.'];
  const out: string[] = [];
  if (ext.esFactura === false) out.push('El archivo no parece una factura o boleta.');
  if (doc && ext.documentoEmisor && soloDigitos(ext.documentoEmisor).replace(/^0+/, '') !== soloDigitos(doc).replace(/^0+/, '')
      && !soloDigitos(ext.documentoEmisor).startsWith(soloDigitos(doc).slice(0, -1))) {
    out.push(`Documento del emisor (${ext.documentoEmisor}) distinto al del advisor (${doc}).`);
  } else if (!ext.documentoEmisor) out.push('No se leyó el documento del emisor.');
  const r = rangoCorte(corte.periodo, corte.corte);
  if (!ext.fecha) out.push('No se leyó la fecha de la factura.');
  else if (ext.fecha < r.desde || ext.fecha > sumarDias(plazoFactura(corte.periodo, corte.corte), 0)) {
    out.push(`Fecha ${ext.fecha} fuera del ${corte.corte === 'MES' ? 'mes' : 'corte'} (${r.desde} a ${r.hasta}, o hasta el plazo).`);
  }
  if (!Number.isNaN(corte.horas) && ext.horas !== null && ext.horas !== undefined && Math.abs(Number(ext.horas) - corte.horas) > 0.01) {
    out.push(`Horas facturadas ${ext.horas} ≠ horas de la plataforma ${corte.horas}.`);
  }
  if (corte.valor !== null) {
    if (ext.bruto === null || ext.bruto === undefined) out.push('No se leyó el valor bruto.');
    else if (Math.abs(Number(ext.bruto) - corte.valor) > Math.max(1, corte.valor * 0.01)) {
      out.push(`Valor bruto ${Number(ext.bruto).toLocaleString('es-CO')} ≠ esperado ${corte.valor.toLocaleString('es-CO')} (horas × tarifa).`);
    }
  }
  return out;
}

/**
 * Cortes del periodo con su estado efectivo, factura vigente y ajustes. Usa la
 * liquidación en vivo (con valores) para horas, valor esperado e inconsistencias.
 */
export async function listarCortes(periodo: string, liq?: Liquidacion, advisorId?: string | null): Promise<CorteInfo[]> {
  const L = liq || await calcularLiquidacion(periodo, { verValores: true, advisorId: advisorId || null });
  const [rows, facturas, ajustes] = await Promise.all([
    queryMany<any>(`SELECT * FROM "LIQ_ADVISOR" WHERE "periodo" = $1 ${advisorId ? `AND "advisorId" = $2` : ''}`, advisorId ? [periodo, advisorId] : [periodo]),
    queryMany<any>(
      `SELECT f.*, l."advisorId", l."programa", l."corte" FROM "LIQ_ADVISOR_FACTURAS" f JOIN "LIQ_ADVISOR" l ON l."_id" = f."liqId"
        WHERE l."periodo" = $1 AND f."estado" <> 'REEMPLAZADA' ${advisorId ? `AND l."advisorId" = $2` : ''} ORDER BY f."subidoEn" DESC`,
      advisorId ? [periodo, advisorId] : [periodo]),
    queryMany<any>(
      `SELECT a.*, TO_CHAR(a."semanaInicio", 'YYYY-MM-DD') AS "semanaStr", l."advisorId", l."programa", l."corte"
         FROM "LIQ_ADVISOR_AJUSTES" a JOIN "LIQ_ADVISOR" l ON l."_id" = a."liqId"
        WHERE l."periodo" = $1 ${advisorId ? `AND l."advisorId" = $2` : ''} ORDER BY a."_createdDate"`,
      advisorId ? [periodo, advisorId] : [periodo]),
  ]);
  const porClave = new Map(rows.map((r) => [clave(r.advisorId, r.programa, r.corte), r]));
  // Todas las facturas no reemplazadas por corte (más reciente primero).
  const factPorClave = new Map<string, any[]>();
  for (const f of facturas) { const k = clave(f.advisorId, f.programa, f.corte); if (!factPorClave.has(k)) factPorClave.set(k, []); factPorClave.get(k)!.push(f); }
  const docs = await documentosAdvisors(Array.from(new Set(L.advisors.map((a) => a.advisorId))));

  const out: CorteInfo[] = [];
  for (const a of L.advisors) {
    for (const c of a.cortes) {
      const k = clave(a.advisorId, a.programaLiq, c.corte);
      const row = porClave.get(k);
      // Conjunto vigente: las recibidas/aceptadas; si no hay, las devueltas (para mostrar el motivo).
      const todas = factPorClave.get(k) || [];
      const vivas = todas.filter((x) => x.estado === 'RECIBIDA' || x.estado === 'ACEPTADA');
      const conjunto = vivas.length ? vivas : todas.filter((x) => x.estado === 'DEVUELTA');
      const f = vivas.find((x) => x.estado === 'RECIBIDA') || conjunto[0];
      const plazo = plazoFactura(periodo, c.corte);
      const requiereFactura = a.tipoContratacion !== 'PLANTA' && (a.tipoContratacion === 'SEMIPLANTA' || c.horas > 0);
      const plazoReenvio = f?.estado === 'DEVUELTA' && f.devueltaEn ? sumarDias(new Date(f.devueltaEn).toISOString().slice(0, 10), 2) : null;
      let estado: EstadoCorte;
      if (row?.estado === 'VERIFICADO' || row?.estado === 'PAGADO') estado = row.estado;
      else if (!requiereFactura) estado = a.tipoContratacion === 'PLANTA' ? 'ABIERTO' : 'SIN_HORAS';
      else if (f?.estado === 'RECIBIDA') estado = 'FACTURA_RECIBIDA';
      else if (f?.estado === 'DEVUELTA') estado = hoyEn(a.pais) > (plazoReenvio && plazoReenvio > plazo ? plazoReenvio : plazo) ? 'SIN_FACTURA' : 'DEVUELTA';
      else estado = hoyEn(a.pais) > plazo ? 'SIN_FACTURA' : 'ABIERTO';
      const snap = row?.snapshot || null;
      out.push({
        liqId: row?._id || null, advisorId: a.advisorId, programa: a.programaLiq, corte: c.corte,
        estado, requiereFactura, plazo, plazoReenvio,
        horas: c.horas, valor: c.valor, moneda: a.valor?.moneda || '',
        horasOk: !!row?.horasOk, horasOkPor: row?.horasOkPor || null,
        verificadoPor: row?.verificadoPor || null, verificadoEn: row?.verificadoEn ? new Date(row.verificadoEn).toISOString() : null,
        pagadoPor: row?.pagadoPor || null, pagadoEn: row?.pagadoEn ? new Date(row.pagadoEn).toISOString() : null,
        referenciaPago: row?.referenciaPago || null,
        snapshot: snap,
        cambioTrasVerificar: !!snap && (Math.abs(Number(snap.horas) - c.horas) > 0.01 || (c.valor !== null && Math.abs(Number(snap.valor) - c.valor) > 0.5)),
        ...(() => {
          const info = (x: any, inc: string[]): FacturaInfo => ({
            _id: x._id, nombre: x.nombre, tipo: x.tipo, estado: x.estado, subidoEn: new Date(x.subidoEn).toISOString(), subidoPor: x.subidoPor,
            concepto: x.concepto || null, extraido: x.extraido, comentarioDevolucion: x.comentarioDevolucion, devueltaPor: x.devueltaPor,
            devueltaEn: x.devueltaEn ? new Date(x.devueltaEn).toISOString() : null, inconsistencias: inc,
          });
          const incConjunto = inconsistenciasConjunto(conjunto, { periodo, corte: c.corte, horas: c.horas, valor: c.valor }, docs.get(a.advisorId) || null);
          return {
            factura: f ? info(f, incConjunto) : null,
            facturas: conjunto.map((x) => info(x, [])),
          };
        })(),
        ajustes: ajustes.filter((x) => clave(x.advisorId, x.programa, x.corte) === k).map((x) => ({
          _id: x._id, alcance: x.alcance, semanaInicio: x.semanaStr, concepto: x.concepto, horas: Number(x.horas), motivo: x.motivo,
          usuarioEmail: x.usuarioEmail, usuarioNombre: x.usuarioNombre, fecha: new Date(x._createdDate).toISOString(),
        })),
      });
    }
  }
  return out;
}

// ── Escritura ────────────────────────────────────────────────────────────────

async function asegurarLiq(advisorId: string, programa: 'LGS' | 'KIDS', periodo: string, corte: Corte): Promise<any> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw new ValidationError('Periodo inválido.');
  if (!['MES', 'Q1', 'Q2'].includes(corte)) throw new ValidationError('Corte inválido.');
  if (!['LGS', 'KIDS'].includes(programa)) throw new ValidationError('Programa inválido.');
  await query(
    `INSERT INTO "LIQ_ADVISOR" ("_id","advisorId","programa","periodo","corte") VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT ON CONSTRAINT "liq_advisor_uq" DO NOTHING`, [generateId('liq'), advisorId, programa, periodo, corte]);
  return queryOne<any>(`SELECT * FROM "LIQ_ADVISOR" WHERE "advisorId"=$1 AND "programa"=$2 AND "periodo"=$3 AND "corte"=$4`, [advisorId, programa, periodo, corte]);
}

async function log(liq: any, accion: string, actor: Actor, detalle: any, estadoAnterior?: string | null, estadoNuevo?: string | null) {
  await query(
    `INSERT INTO "LIQ_ADVISOR_LOG" ("_id","liqId","advisorId","accion","estadoAnterior","estadoNuevo","detalle","usuarioEmail","usuarioNombre","usuarioRol")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [generateId('lql'), liq?._id || null, liq?.advisorId || null, accion, estadoAnterior ?? null, estadoNuevo ?? null,
     JSON.stringify(detalle ?? {}), actor.email, actor.nombre || null, actor.rol]);
}

async function corteActual(advisorId: string, programa: 'LGS' | 'KIDS', periodo: string, corte: Corte): Promise<CorteInfo> {
  const c = (await listarCortes(periodo, undefined, advisorId)).find((x) => x.programa === programa && x.corte === corte);
  if (!c) throw new NotFoundError('Corte del advisor', `${advisorId} ${programa} ${periodo} ${corte}`);
  return c;
}

const CERRADOS: EstadoCorte[] = ['VERIFICADO', 'PAGADO'];

export async function agregarAjuste(p: { advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte; alcance: string; semanaInicio?: string | null; concepto: string; horas: number; motivo: string }, actor: Actor) {
  const horas = Number(p.horas);
  if (!Number.isFinite(horas) || horas === 0 || Math.round(horas * 2) !== horas * 2) throw new ValidationError('Las horas del ajuste deben ser múltiplos de 0,5 (positivas o negativas) y distintas de 0.');
  if (Math.abs(horas) > 300) throw new ValidationError('Ajuste fuera de rango.');
  if (!(CONCEPTOS_AJUSTE as readonly string[]).includes(p.concepto)) throw new ValidationError('Concepto de ajuste inválido.');
  if (!['SEMANA', 'TOTAL'].includes(p.alcance)) throw new ValidationError('Alcance inválido (SEMANA o TOTAL).');
  if (p.alcance === 'SEMANA' && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.semanaInicio || ''))) throw new ValidationError('Indique la semana del ajuste.');
  const motivo = String(p.motivo || '').trim();
  if (motivo.length < 10) throw new ValidationError('El motivo debe tener al menos 10 caracteres.');
  const c = await corteActual(p.advisorId, p.programa, p.periodo, p.corte);
  if (CERRADOS.includes(c.estado)) throw new ConflictError('El corte ya está verificado: no admite ajustes (solo SUPER_ADMIN puede reabrirlo).');
  const liq = await asegurarLiq(p.advisorId, p.programa, p.periodo, p.corte);
  const id = generateId('laj');
  await query(
    `INSERT INTO "LIQ_ADVISOR_AJUSTES" ("_id","liqId","alcance","semanaInicio","concepto","horas","motivo","usuarioEmail","usuarioNombre")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, liq._id, p.alcance, p.alcance === 'SEMANA' ? p.semanaInicio : null, p.concepto, horas, motivo, actor.email, actor.nombre || null]);
  // Un ajuste nuevo invalida la revisión de horas anterior.
  if (liq.horasOk) await query(`UPDATE "LIQ_ADVISOR" SET "horasOk"=false, "horasOkPor"=NULL, "horasOkEn"=NULL, "_updatedDate"=NOW() WHERE "_id"=$1`, [liq._id]);
  await log(liq, 'AJUSTE', actor, { id, alcance: p.alcance, semanaInicio: p.semanaInicio || null, concepto: p.concepto, horas, motivo });
  return id;
}

export async function marcarHorasOk(p: { advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte; ok: boolean }, actor: Actor) {
  const c = await corteActual(p.advisorId, p.programa, p.periodo, p.corte);
  if (CERRADOS.includes(c.estado)) throw new ConflictError('El corte ya está verificado.');
  const liq = await asegurarLiq(p.advisorId, p.programa, p.periodo, p.corte);
  await query(`UPDATE "LIQ_ADVISOR" SET "horasOk"=$2, "horasOkPor"=$3, "horasOkEn"=CASE WHEN $2 THEN NOW() END, "_updatedDate"=NOW() WHERE "_id"=$1`,
    [liq._id, p.ok, p.ok ? actor.email : null]);
  await log(liq, p.ok ? 'HORAS_OK' : 'HORAS_OK_RETIRADO', actor, { horas: c.horas });
}

// ── Facturas ─────────────────────────────────────────────────────────────────

const PROMPT_FACTURA = `Eres un extractor de datos de FACTURAS, BOLETAS DE HONORARIOS y CUENTAS DE COBRO emitidas por profesores (advisors) a una empresa en Latinoamérica (Chile: boleta de honorarios SII con RUT y retención; Colombia: factura o cuenta de cobro con NIT/cédula; Ecuador: factura con RUC/cédula).

Analiza el documento y devuelve EXCLUSIVAMENTE un objeto JSON válido con EXACTAMENTE estas claves:
{
  "esFactura": boolean,              // true si es una factura, boleta de honorarios o cuenta de cobro por servicios.
  "tipoDocumento": string|null,      // p. ej. "Boleta de honorarios electrónica", "Factura", "Cuenta de cobro".
  "numero": string|null,             // número o folio del documento.
  "fecha": string|null,              // fecha de emisión YYYY-MM-DD.
  "emisor": string|null,             // nombre de quien emite (el profesor).
  "documentoEmisor": string|null,    // RUT / NIT / RUC / cédula de quien emite, tal como aparece.
  "periodo": string|null,            // periodo de los servicios si aparece (p. ej. "octubre 2026", "1-15 octubre").
  "horas": number|null,              // número de horas facturadas si aparece explícito.
  "bruto": number|null,              // valor BRUTO (antes de retención), solo el número.
  "retencion": number|null,          // retención o impuesto retenido, si aparece.
  "liquido": number|null,            // valor líquido a pagar, si aparece.
  "moneda": string|null,             // CLP, COP o USD si se puede deducir.
  "confianza": number                // 0 a 1.
}
Reglas: no inventes datos (usa null si no estás seguro); los montos sin símbolos ni separadores de miles; responde solo el JSON.`;

const MAX_FACTURA = 10 * 1024 * 1024;
const TIPOS_FACTURA: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function leerFacturaIA(buf: Buffer, contentType: string, nombre: string): Promise<any | null> {
  try {
    const p = await llamarOpenAIJson(PROMPT_FACTURA, archivoComoContenidoIA(buf, contentType, nombre), 'facturas-advisors');
    const n = (x: any) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
    return {
      esFactura: p.esFactura !== false, tipoDocumento: p.tipoDocumento ?? null, numero: p.numero ?? null,
      fecha: typeof p.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ? p.fecha : null,
      emisor: p.emisor ?? null, documentoEmisor: p.documentoEmisor ?? null, periodo: p.periodo ?? null,
      horas: n(p.horas), bruto: n(p.bruto), retencion: n(p.retencion), liquido: n(p.liquido),
      moneda: p.moneda ?? null, confianza: n(p.confianza),
    };
  } catch (e: any) {
    console.warn('[liq-flujo] lectura IA de factura falló:', e?.message);
    return null;
  }
}

/**
 * Sube la factura/boleta de un corte. El advisor solo hasta el plazo (o 2 días tras una
 * devolución); el personal con permiso puede subirla en su nombre mientras no esté verificado.
 */
export async function subirFactura(p: {
  advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte; archivo: { buf: Buffer; tipo: string; nombre: string };
  /** Qué cobra esta factura (NORMAL, EXAM_INTERN, FESTIVO, OTRO). */
  concepto?: string | null;
  /**
   * 'reemplazar' (por defecto): la nueva sustituye a todas las del corte (una sola factura).
   * 'agregar': se suma a las recibidas (hasta MAX_FACTURAS_CORTE); tras una devolución abre un conjunto nuevo.
   * Con `reemplazaId` sustituye solo esa factura.
   */
  modo?: 'reemplazar' | 'agregar'; reemplazaId?: string | null;
}, actor: Actor, opts: { esAdvisor: boolean }) {
  const concepto = p.concepto ? String(p.concepto).toUpperCase() : null;
  if (concepto && !(CONCEPTOS_FACTURA as readonly string[]).includes(concepto)) throw new ValidationError('Concepto de factura inválido.');
  const ext = TIPOS_FACTURA[p.archivo.tipo];
  if (!ext) throw new ValidationError('Formato no permitido: suba PDF, JPG, PNG o WEBP.');
  if (p.archivo.buf.length > MAX_FACTURA) throw new ValidationError('El archivo supera 10 MB.');
  const c = await corteActual(p.advisorId, p.programa, p.periodo, p.corte);
  if (CERRADOS.includes(c.estado)) throw new ConflictError('El corte ya está verificado: la factura no se puede reemplazar.');
  if (!c.requiereFactura) throw new ValidationError(c.estado === 'SIN_HORAS' ? 'No hay horas en este corte.' : 'Este advisor no factura (planta).');
  if (opts.esAdvisor && c.estado === 'SIN_FACTURA') throw new ForbiddenError(`Venció el plazo para subir la factura (${c.plazoReenvio || c.plazo}). Comuníquese con Administración.`);
  const liq = await asegurarLiq(p.advisorId, p.programa, p.periodo, p.corte);
  const key = `facturas-advisors/${p.periodo}/${p.advisorId}/${p.programa}-${p.corte}-${Date.now()}.${ext}`;
  await spacesClient.send(new PutObjectCommand({ Bucket: SPACES_BUCKET, Key: key, Body: p.archivo.buf, ContentType: p.archivo.tipo, ACL: 'private' }));
  if (p.reemplazaId) {
    const r = await queryOne<{ estado: string }>(`SELECT "estado" FROM "LIQ_ADVISOR_FACTURAS" WHERE "_id"=$1 AND "liqId"=$2`, [p.reemplazaId, liq._id]);
    if (!r || !['RECIBIDA', 'DEVUELTA'].includes(r.estado)) throw new ConflictError('Esa factura ya no se puede reemplazar.');
  } else if (p.modo === 'agregar') {
    const n = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "LIQ_ADVISOR_FACTURAS" WHERE "liqId"=$1 AND "estado"='RECIBIDA'`, [liq._id]);
    if (Number(n?.n || 0) >= MAX_FACTURAS_CORTE) throw new ValidationError(`Máximo ${MAX_FACTURAS_CORTE} facturas por corte: reemplace o quite una.`);
  }
  const extraido = await leerFacturaIA(p.archivo.buf, p.archivo.tipo, p.archivo.nombre);
  if (p.reemplazaId) {
    await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='REEMPLAZADA' WHERE "_id"=$1`, [p.reemplazaId]);
  } else if (p.modo === 'agregar') {
    // Tras una devolución, lo devuelto se reemplaza por el conjunto nuevo que se está subiendo.
    await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='REEMPLAZADA' WHERE "liqId"=$1 AND "estado"='DEVUELTA'`, [liq._id]);
  } else {
    await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='REEMPLAZADA' WHERE "liqId"=$1 AND "estado" IN ('RECIBIDA','DEVUELTA')`, [liq._id]);
  }
  const id = generateId('lfa');
  await query(
    `INSERT INTO "LIQ_ADVISOR_FACTURAS" ("_id","liqId","url","nombre","tipo","extraido","estado","subidoPor","concepto") VALUES ($1,$2,$3,$4,$5,$6,'RECIBIDA',$7,$8)`,
    [id, liq._id, key, p.archivo.nombre.slice(0, 250), p.archivo.tipo, extraido ? JSON.stringify(extraido) : null, actor.email, concepto]);
  await log(liq, 'FACTURA_SUBIDA', actor, { id, nombre: p.archivo.nombre, concepto, modo: p.reemplazaId ? 'reemplazar-una' : p.modo || 'reemplazar', enNombreDe: !opts.esAdvisor, leida: !!extraido }, c.estado, 'FACTURA_RECIBIDA');
  return { id, extraido };
}

/** Quita una factura recibida del corte (p. ej. subida por error). El advisor solo las suyas; nunca con el corte verificado. */
export async function quitarFactura(facturaId: string, actor: Actor, opts: { advisorId?: string; desdeKids?: boolean }) {
  const f = await queryOne<any>(
    `SELECT f."_id", f."estado", f."nombre", l."_id" AS "liqId", l."advisorId", l."programa", l."periodo", l."corte", l."estado" AS "estadoLiq"
       FROM "LIQ_ADVISOR_FACTURAS" f JOIN "LIQ_ADVISOR" l ON l."_id" = f."liqId" WHERE f."_id" = $1`, [facturaId]);
  if (!f || (opts.advisorId && f.advisorId !== opts.advisorId)) throw new NotFoundError('Factura', facturaId);
  // Las de Kids las quita la guía desde KIDS (llega por /api/kids-sync/factura-guia), no desde LGS.
  if (f.programa === 'KIDS' && !opts.desdeKids) throw new ValidationError('Las facturas de Kids se gestionan en la plataforma KIDS.');
  if (CERRADOS.includes(f.estadoLiq)) throw new ConflictError('El corte ya está verificado: la factura no se puede quitar.');
  if (f.estado !== 'RECIBIDA') throw new ConflictError('Solo se puede quitar una factura recibida.');
  await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='REEMPLAZADA' WHERE "_id"=$1`, [facturaId]);
  await log({ _id: f.liqId, advisorId: f.advisorId }, 'FACTURA_QUITADA', actor, { id: facturaId, nombre: f.nombre });
}

export async function urlFactura(facturaId: string): Promise<{ url: string; advisorId: string }> {
  const f = await queryOne<any>(`SELECT f."url", l."advisorId" FROM "LIQ_ADVISOR_FACTURAS" f JOIN "LIQ_ADVISOR" l ON l."_id" = f."liqId" WHERE f."_id"=$1`, [facturaId]);
  if (!f) throw new NotFoundError('Factura', facturaId);
  const url = await getSignedUrl(spacesClient, new GetObjectCommand({ Bucket: SPACES_BUCKET, Key: f.url }), { expiresIn: 600 });
  return { url, advisorId: f.advisorId };
}

export async function devolverFactura(p: { advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte; comentario: string }, actor: Actor) {
  const comentario = String(p.comentario || '').trim();
  if (comentario.length < 10) throw new ValidationError('Explique al advisor qué debe corregir (mínimo 10 caracteres).');
  const c = await corteActual(p.advisorId, p.programa, p.periodo, p.corte);
  if (c.estado !== 'FACTURA_RECIBIDA' || !c.factura) throw new ConflictError('No hay una factura recibida para devolver.');
  // Se devuelve el CONJUNTO (todas las recibidas del corte): el advisor sube de nuevo lo que corresponda.
  const ids = c.facturas.filter((f) => f.estado === 'RECIBIDA').map((f) => f._id);
  await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='DEVUELTA', "comentarioDevolucion"=$2, "devueltaPor"=$3, "devueltaEn"=NOW() WHERE "_id" = ANY($1::text[])`,
    [ids, comentario, actor.email]);
  await log({ _id: c.liqId, advisorId: p.advisorId }, 'FACTURA_DEVUELTA', actor, { facturaIds: ids, comentario }, c.estado, 'DEVUELTA');
  await avisarKids(c.liqId, 'DEVUELTA', comentario);
}

/** Guías Kids: la factura vino de KIDS → se le devuelve el estado (import dinámico: evita ciclo). */
async function avisarKids(liqId: string | null, estado: 'RECIBIDA' | 'DEVUELTA' | 'ACEPTADA' | 'PAGADA', motivo?: string) {
  const { avisarEstadoFacturasKids } = await import('@/lib/kids-facturas-guias');
  await avisarEstadoFacturasKids(liqId, estado, motivo);
}

export async function verificar(p: { advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte }, actor: Actor) {
  const L = await calcularLiquidacion(p.periodo, { verValores: true, advisorId: p.advisorId });
  const a = L.advisors.find((x) => x.programaLiq === p.programa);
  const c = (await listarCortes(p.periodo, L, p.advisorId)).find((x) => x.programa === p.programa && x.corte === p.corte);
  if (!a || !c) throw new NotFoundError('Corte del advisor', p.advisorId);
  if (CERRADOS.includes(c.estado)) throw new ConflictError('El corte ya está verificado.');
  if (!c.horasOk) throw new ConflictError('Académico aún no marca las horas como revisadas (Horas OK).');
  if (c.requiereFactura && c.estado !== 'FACTURA_RECIBIDA') throw new ConflictError('Falta la factura del advisor (o fue devuelta).');
  if (c.valor === null) throw new ConflictError('Sin valor calculado: revise tarifas.');
  const liq = await asegurarLiq(p.advisorId, p.programa, p.periodo, p.corte);
  const snapshot = {
    horas: c.horas, valor: c.valor, moneda: c.moneda, corte: p.corte, tipoContratacion: a.tipoContratacion, categoria: a.categoriaTarifa,
    porConcepto: p.corte === 'MES' ? a.porConcepto : a.porConceptoQ[p.corte === 'Q1' ? 'q1' : 'q2'],
    porTipo: a.porTipo, tarifas: a.valor?.tarifas, fijo: a.valor?.fijo, reparto: a.reparto, totalMes: a.total, valorMes: a.valor?.total,
    tipoCambio: L.tipoCambio,
    factura: c.factura ? { id: c.factura._id, ids: c.facturas.map((f) => f._id), inconsistencias: c.factura.inconsistencias } : null,
    congeladoEn: new Date().toISOString(),
  };
  await query(
    `UPDATE "LIQ_ADVISOR" SET "estado"='VERIFICADO', "snapshot"=$2, "valor"=$3, "moneda"=$4, "verificadoPor"=$5, "verificadoEn"=NOW(), "_updatedDate"=NOW() WHERE "_id"=$1`,
    [liq._id, JSON.stringify(snapshot), c.valor, c.moneda, actor.email]);
  await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='ACEPTADA' WHERE "liqId"=$1 AND "estado"='RECIBIDA'`, [liq._id]);
  await log(liq, 'VERIFICADO', actor, { horas: c.horas, valor: c.valor, moneda: c.moneda, inconsistencias: c.factura?.inconsistencias || [] }, c.estado, 'VERIFICADO');
  if (p.programa === 'KIDS') await avisarKids(liq._id, 'ACEPTADA');
}

export async function bloqueoPorGrupoActivo(): Promise<boolean> {
  const r = await queryOne<{ value: string }>(`SELECT "value" FROM "APP_CONFIG" WHERE "key" = 'gestion_advisors_bloqueo_grupo'`);
  return (r?.value ?? 'true') !== 'false';
}

export async function registrarPago(p: { advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte; fecha: string; referencia: string }, actor: Actor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha || ''))) throw new ValidationError('Fecha de pago inválida.');
  const referencia = String(p.referencia || '').trim();
  if (referencia.length < 3) throw new ValidationError('Indique la referencia del pago.');
  const L = await calcularLiquidacion(p.periodo, { verValores: true });
  const todos = await listarCortes(p.periodo, L);
  const c = todos.find((x) => x.advisorId === p.advisorId && x.programa === p.programa && x.corte === p.corte);
  if (!c) throw new NotFoundError('Corte del advisor', p.advisorId);
  if (c.estado !== 'VERIFICADO') throw new ConflictError('Solo se registra el pago de un corte VERIFICADO.');
  if (await bloqueoPorGrupoActivo()) {
    const pais = L.advisors.find((a) => a.advisorId === p.advisorId)?.pais;
    const bloquean = todos.filter((x) => x.corte === p.corte && x.estado === 'SIN_FACTURA' && L.advisors.find((a) => a.advisorId === x.advisorId)?.pais === pais);
    if (bloquean.length) {
      const nombres = bloquean.map((x) => L.advisors.find((a) => a.advisorId === x.advisorId)?.nombre).filter(Boolean).join(', ');
      throw new ConflictError(`Pago del grupo ${pais} bloqueado: ${bloquean.length} advisor(s) SIN FACTURA (${nombres}).`);
    }
  }
  await query(
    `UPDATE "LIQ_ADVISOR" SET "estado"='PAGADO', "pagadoPor"=$2, "pagadoEn"=$3::date, "referenciaPago"=$4, "_updatedDate"=NOW() WHERE "_id"=$1`,
    [c.liqId, actor.email, p.fecha, referencia]);
  await log({ _id: c.liqId, advisorId: p.advisorId }, 'PAGADO', actor, { fecha: p.fecha, referencia, valor: c.snapshot?.valor, moneda: c.snapshot?.moneda }, 'VERIFICADO', 'PAGADO');
  if (p.programa === 'KIDS') await avisarKids(c.liqId, 'PAGADA');
}

export async function reabrir(p: { advisorId: string; programa: 'LGS' | 'KIDS'; periodo: string; corte: Corte; motivo: string }, actor: Actor) {
  if (actor.rol !== 'SUPER_ADMIN') throw new ForbiddenError('Solo SUPER_ADMIN puede reabrir un corte verificado.');
  const motivo = String(p.motivo || '').trim();
  if (motivo.length < 10) throw new ValidationError('El motivo debe tener al menos 10 caracteres.');
  const liq = await queryOne<any>(`SELECT * FROM "LIQ_ADVISOR" WHERE "advisorId"=$1 AND "programa"=$2 AND "periodo"=$3 AND "corte"=$4`,
    [p.advisorId, p.programa, p.periodo, p.corte]);
  if (!liq || !['VERIFICADO', 'PAGADO'].includes(liq.estado)) throw new ConflictError('El corte no está verificado.');
  await query(
    `UPDATE "LIQ_ADVISOR" SET "estado"='ABIERTO', "horasOk"=false, "verificadoPor"=NULL, "verificadoEn"=NULL,
            "pagadoPor"=NULL, "pagadoEn"=NULL, "referenciaPago"=NULL, "_updatedDate"=NOW() WHERE "_id"=$1`, [liq._id]);
  await query(`UPDATE "LIQ_ADVISOR_FACTURAS" SET "estado"='RECIBIDA' WHERE "liqId"=$1 AND "estado"='ACEPTADA'`, [liq._id]);
  await log(liq, 'REABIERTO', actor, { motivo, snapshotAnterior: liq.snapshot, pago: liq.referenciaPago }, liq.estado, 'ABIERTO');
  if (p.programa === 'KIDS') await avisarKids(liq._id, 'RECIBIDA');
}

export async function logDeAdvisor(advisorId: string, periodo: string) {
  return queryMany<any>(
    `SELECT g."accion", g."estadoAnterior", g."estadoNuevo", g."detalle", g."usuarioEmail", g."usuarioRol", g."_createdDate", l."corte", l."programa"
       FROM "LIQ_ADVISOR_LOG" g LEFT JOIN "LIQ_ADVISOR" l ON l."_id" = g."liqId"
      WHERE g."advisorId" = $1 AND (l."periodo" = $2 OR g."liqId" IS NULL)
      ORDER BY g."_createdDate" DESC LIMIT 200`, [advisorId, periodo]);
}

/** Advisor (ficha) del usuario de la sesión, por login enlazado o por correo. */
export async function advisorDeSesion(email: string): Promise<{ _id: string; nombre: string; pais: string | null; programa: string; tipoContratacion: string } | null> {
  return queryOne<any>(
    `SELECT a."_id", COALESCE(NULLIF(TRIM(a."nombreCompleto"), ''), TRIM(CONCAT(a."primerNombre", ' ', a."primerApellido"))) AS nombre,
            a."pais", a."programa", a."tipoContratacion"
       FROM "ADVISORS" a
       LEFT JOIN "USUARIOS_ROLES" u ON u."_id" = a."usuarioRolId"
      WHERE COALESCE(a."activo", false) = true AND (LOWER(a."email") = LOWER($1) OR LOWER(u."email") = LOWER($1))
      ORDER BY (LOWER(a."email") = LOWER($1)) DESC LIMIT 1`, [email]);
}

export type { AdvisorLiq };
