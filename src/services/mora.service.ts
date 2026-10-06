import 'server-only';
import { queryOne, queryMany, query } from '@/lib/postgres';
import { generateId } from '@/lib/id-generator';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { AppConfigRepository } from '@/repositories/config.repository';
import { calcularMora, parseMonto, type MoraCalculo } from '@/lib/mora';

/**
 * Mora de contratos: bloqueo de certificados + informe Recaudos › Usuarios en mora.
 *
 * - El cálculo es el mismo de la pestaña Financiera (src/lib/mora.ts).
 * - El BLOQUEO del certificado está detrás de un interruptor en APP_CONFIG
 *   (`bloqueo_certificado_mora_activo`, default false) porque hoy la mayoría de
 *   contratos anteriores a mayo-2026 no tiene sus cuotas registradas.
 * - Recaudos puede DESBLOQUEAR manualmente un contrato (CERTIFICADO_DESBLOQUEOS,
 *   creada por scripts/create-certificado-desbloqueos.js). Un desbloqueo activo
 *   habilita el certificado a todos los beneficiarios del contrato.
 */

const FLAG_KEY = 'bloqueo_certificado_mora_activo';
const TTL_MS = 60_000;
let flagCache: { value: boolean; expires: number } | null = null;

export interface DesbloqueoInfo {
  _id: string;
  motivo: string;
  desbloqueadoPor: string | null;
  desbloqueadoPorNombre: string | null;
  fecha: string;
}

export interface BloqueoMora {
  contrato: string;
  diaCorte: number;
  cuotasVencidas: number;
  cuotasRegistradas: number;
  cuotasAtrasadas: number;
  fechaPrimeraImpaga: string | null;
  diasMora: number;
  valorCuota: number | null;
  valorAtrasado: number | null;
}

export interface UsuarioEnMora {
  titularId: string;
  titular: string;
  numeroId: string;
  contrato: string;
  plataforma: string | null;
  finalContrato: string | null;
  estadoContrato: 'VIGENTE' | 'ONHOLD' | 'FINALIZADO' | 'INACTIVO';
  celular: string | null;
  email: string | null;
  /** USUARIOS_ROLES._id del ejecutivo de recaudo asignado (PEOPLE.gestorRecaudo). */
  gestorRecaudo: string | null;
  gestorNombre: string | null;
  /** Niveles actuales (ACADEMICA.nivel) de los beneficiarios del contrato. */
  niveles: string[];
  mora: MoraCalculo;
  valorCuota: number | null;
  valorAtrasado: number | null;
  desbloqueo: DesbloqueoInfo | null;
}

// Documento normalizado (sin puntos/espacios/guiones, mayúsculas) — mismo criterio del resto de la plataforma.
const NID = (col: string) => `UPPER(REGEXP_REPLACE(COALESCE(${col},''), '[.[:space:]_-]', '', 'g'))`;

const SQL_FIN = `SELECT DISTINCT ON (f."contrato") f."contrato", f."fechaPago", f."numeroCuotas", f."valorCuota", f."saldo"
                   FROM "FINANCIEROS" f`;

function estadoContrato(r: any): UsuarioEnMora['estadoContrato'] {
  if (String(r.estado || '').toUpperCase() === 'FINALIZADA') return 'FINALIZADO';
  if (r.estadoInactivo === true) return r.fechaOnHold ? 'ONHOLD' : 'INACTIVO';
  return 'VIGENTE';
}
function montoONull(v: unknown): number | null {
  const n = parseMonto(v);
  return isNaN(n) ? null : n;
}
function toDesbloqueo(r: any): DesbloqueoInfo | null {
  if (!r?.d_id) return null;
  return { _id: r.d_id, motivo: r.d_motivo, desbloqueadoPor: r.d_por, desbloqueadoPorNombre: r.d_por_nombre, fecha: r.d_fecha };
}

export const moraService = {
  /** ¿Está activo el bloqueo de certificados por mora? (cache 60s, default false) */
  async isBloqueoActivo(): Promise<boolean> {
    const now = Date.now();
    if (flagCache && flagCache.expires > now) return flagCache.value;
    const row = await AppConfigRepository.get(FLAG_KEY);
    const value = row?.value === 'true';
    flagCache = { value, expires: now + TTL_MS };
    return value;
  },

  async setBloqueoActivo(active: boolean, actor: string): Promise<void> {
    await AppConfigRepository.set(FLAG_KEY, active ? 'true' : 'false', '#ffffff', actor);
    flagCache = null;
  },

  /** Mora del contrato (titular aprobado más reciente + FINANCIEROS + cuotas registradas). */
  async getMoraContrato(contrato: string): Promise<{ mora: MoraCalculo | null; titularId: string | null; valorCuota: number | null } | null> {
    if (!contrato) return null;
    const tit = await queryOne<any>(
      `SELECT "_id" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
        ORDER BY ("aprobacion" = 'Aprobado') DESC, "_createdDate" DESC LIMIT 1`, [contrato]);
    const fin = await queryOne<any>(`${SQL_FIN} WHERE f."contrato" = $1 ORDER BY f."contrato", f."_createdDate" DESC`, [contrato]);
    if (!tit || !fin) return { mora: null, titularId: tit?._id ?? null, valorCuota: null };
    const reg = await queryOne<{ n: number }>(
      `SELECT COUNT(DISTINCT "numCuota")::int n FROM "PAGOS_TITULARES" WHERE "idPeople" = $1 AND "numCuota" > 0`, [tit._id]);
    const mora = calcularMora({ fechaPago: fin.fechaPago, numeroCuotas: fin.numeroCuotas, cuotasRegistradas: reg?.n ?? 0, saldo: fin.saldo });
    return { mora, titularId: tit._id, valorCuota: montoONull(fin.valorCuota) };
  },

  async getDesbloqueoActivo(contrato: string): Promise<DesbloqueoInfo | null> {
    const r = await queryOne<any>(
      `SELECT "_id" d_id, "motivo" d_motivo, "desbloqueadoPor" d_por, "desbloqueadoPorNombre" d_por_nombre, "_createdDate" d_fecha
         FROM "CERTIFICADO_DESBLOQUEOS" WHERE "contrato" = $1 AND "activo" LIMIT 1`, [contrato]);
    return toDesbloqueo(r);
  },

  /**
   * Causa del bloqueo del certificado para un contrato, o null si se puede generar
   * (interruptor apagado, contrato al día, sin datos financieros o desbloqueado por Recaudos).
   */
  async getBloqueoCertificado(contrato: string | null | undefined): Promise<BloqueoMora | null> {
    if (!contrato) return null;
    if (!(await this.isBloqueoActivo())) return null;
    const info = await this.getMoraContrato(contrato);
    const mora = info?.mora;
    if (!mora || mora.estado !== 'EN_MORA') return null;
    if (await this.getDesbloqueoActivo(contrato)) return null;
    const valorCuota = info?.valorCuota ?? null;
    return {
      contrato,
      diaCorte: mora.diaCorte,
      cuotasVencidas: mora.cuotasVencidas,
      cuotasRegistradas: mora.cuotasRegistradas,
      cuotasAtrasadas: mora.cuotasAtrasadas,
      fechaPrimeraImpaga: mora.fechaPrimeraImpaga,
      diasMora: mora.diasMora,
      valorCuota,
      valorAtrasado: valorCuota != null ? valorCuota * mora.cuotasAtrasadas : null,
    };
  },

  /** Titulares APROBADOS cuyo contrato está EN_MORA (todos los estados del contrato). */
  async listarEnMora(): Promise<UsuarioEnMora[]> {
    const rows = await queryMany<any>(`
      WITH tit AS (
        SELECT DISTINCT ON (p."contrato") p."_id", p."contrato", p."numeroId", p."plataforma", p."celular", p."email", p."gestorRecaudo",
               p."finalContrato"::text AS "finalContrato", p."estado", p."estadoInactivo", p."fechaOnHold",
               TRIM(REGEXP_REPLACE(CONCAT_WS(' ', p."primerNombre", p."segundoNombre", p."primerApellido", p."segundoApellido"), '\\s+', ' ', 'g')) AS titular
          FROM "PEOPLE" p
         WHERE p."tipoUsuario" = 'TITULAR' AND p."aprobacion" = 'Aprobado'
           AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'
         ORDER BY p."contrato", p."_createdDate" DESC
      ), fin AS (
        ${SQL_FIN} WHERE COALESCE(f."contrato",'') <> '' ORDER BY f."contrato", f."_createdDate" DESC
      ), pag AS (
        SELECT pt."idPeople", COUNT(DISTINCT pt."numCuota")::int AS registradas
          FROM "PAGOS_TITULARES" pt WHERE pt."numCuota" > 0 GROUP BY pt."idPeople"
      ), acad AS (
        -- Ficha académica más reciente por documento normalizado (join en bloque, sin subconsultas por fila).
        SELECT DISTINCT ON (${NID('a."numeroId"')}) ${NID('a."numeroId"')} AS nid, a."nivel"
          FROM "ACADEMICA" a WHERE COALESCE(a."numeroId",'') <> ''
         ORDER BY ${NID('a."numeroId"')}, a."_createdDate" DESC
      ), niv AS (
        SELECT x."contrato", array_agg(DISTINCT acad."nivel") FILTER (WHERE acad."nivel" IS NOT NULL) AS niveles
          FROM "PEOPLE" x
          JOIN tit ON tit."contrato" = x."contrato"
          JOIN acad ON acad.nid = ${NID('x."numeroId"')}
         WHERE x."tipoUsuario" <> 'TITULAR'
         GROUP BY x."contrato"
      )
      SELECT tit.*, fin."fechaPago", fin."numeroCuotas", fin."valorCuota", fin."saldo", COALESCE(pag.registradas, 0) AS registradas,
             COALESCE(niv.niveles, '{}') AS niveles,
             d."_id" d_id, d."motivo" d_motivo, d."desbloqueadoPor" d_por, d."desbloqueadoPorNombre" d_por_nombre, d."_createdDate" d_fecha,
             COALESCE(NULLIF(TRIM(u."nombre"), ''), u."email") AS "gestorNombre"
        FROM tit
        JOIN fin ON fin."contrato" = tit."contrato"
        LEFT JOIN pag ON pag."idPeople" = tit."_id"
        LEFT JOIN niv ON niv."contrato" = tit."contrato"
        LEFT JOIN "USUARIOS_ROLES" u ON u."_id" = tit."gestorRecaudo"
        LEFT JOIN "CERTIFICADO_DESBLOQUEOS" d ON d."contrato" = tit."contrato" AND d."activo"`);

    const out: UsuarioEnMora[] = [];
    for (const r of rows) {
      const mora = calcularMora({ fechaPago: r.fechaPago, numeroCuotas: r.numeroCuotas, cuotasRegistradas: r.registradas, saldo: r.saldo });
      if (!mora || mora.estado !== 'EN_MORA') continue;
      const valorCuota = montoONull(r.valorCuota);
      out.push({
        titularId: r._id, titular: r.titular, numeroId: r.numeroId, contrato: r.contrato, plataforma: r.plataforma,
        finalContrato: r.finalContrato, estadoContrato: estadoContrato(r), celular: r.celular, email: r.email,
        gestorRecaudo: r.gestorRecaudo || null, gestorNombre: r.gestorRecaudo ? (r.gestorNombre || 'Gestor sin nombre') : null,
        niveles: Array.isArray(r.niveles) ? r.niveles.filter(Boolean) : [],
        mora, valorCuota, valorAtrasado: valorCuota != null ? valorCuota * mora.cuotasAtrasadas : null,
        desbloqueo: toDesbloqueo(r),
      });
    }
    return out.sort((a, b) => b.mora.diasMora - a.mora.diasMora);
  },

  async desbloquear(contrato: string, motivo: string, actor: { email: string; nombre?: string | null }): Promise<DesbloqueoInfo> {
    const m = String(motivo || '').trim();
    if (m.length < 10) throw new ValidationError('El motivo es obligatorio (mínimo 10 caracteres)');
    const tit = await queryOne<any>(
      `SELECT "_id", TRIM(CONCAT_WS(' ', "primerNombre", "primerApellido")) nombre FROM "PEOPLE"
        WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' ORDER BY ("aprobacion" = 'Aprobado') DESC, "_createdDate" DESC LIMIT 1`, [contrato]);
    if (!tit) throw new NotFoundError('Contrato', contrato);
    if (await this.getDesbloqueoActivo(contrato)) throw new ConflictError('El contrato ya está desbloqueado');
    const id = generateId('desb');
    await query(
      `INSERT INTO "CERTIFICADO_DESBLOQUEOS" ("_id","contrato","titularId","titularNombre","motivo","activo","desbloqueadoPor","desbloqueadoPorNombre")
       VALUES ($1,$2,$3,$4,$5,true,$6,$7)`,
      [id, contrato, tit._id, tit.nombre, m, actor.email, actor.nombre ?? null]);
    return (await this.getDesbloqueoActivo(contrato))!;
  },

  async revocarDesbloqueo(contrato: string, actorEmail: string): Promise<void> {
    const r = await query(
      `UPDATE "CERTIFICADO_DESBLOQUEOS" SET "activo" = false, "revocadoPor" = $2, "revocadoEn" = NOW()
        WHERE "contrato" = $1 AND "activo"`, [contrato, actorEmail]);
    if (!r.rowCount) throw new NotFoundError('Desbloqueo activo', contrato);
  },
};
