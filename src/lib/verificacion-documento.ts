import 'server-only';
import { queryMany, queryOne } from '@/lib/postgres';
import { normalizeNumeroId } from '@/lib/numeroid-normalize';

/**
 * Verificación de un documento al crear un contrato: ¿en qué OTROS contratos
 * VIVOS aparece este documento, con qué rol y en qué situación?
 *
 * Reglas (acordadas 2026-10-05):
 *  - "Aprobado" = aprobacion='Aprobado', CON O SIN firma (44% de los aprobados
 *    no tienen firma: los aprobó un admin o vienen de Wix). La firma solo
 *    cambia el texto del mensaje.
 *  - Se IGNORAN los contratos muertos: FINALIZADA/ANULADO, Contrato nulo /
 *    Devuelto / Rechazado / Retractado, inactivos (salvo OnHold, que sigue
 *    vivo) y los de prueba PRB-. Así una re-matrícula no se bloquea.
 *  - Comparación del documento normalizada (mayúsculas, sin . - _ espacios).
 */

const SQL_NORM = `UPPER(REGEXP_REPLACE(COALESCE("numeroId", ''), '[.[:space:]_-]', '', 'g'))`;
const APROBACION_MUERTA = ['CONTRATO NULO', 'DEVUELTO', 'RECHAZADO', 'RETRACTADO'];

export type Situacion = 'APROBADO' | 'FIRMADO_SIN_APROBAR' | 'SIN_FIRMAR';

export interface RegistroDocumento {
  personId: string;
  tipoUsuario: 'TITULAR' | 'BENEFICIARIO' | string;
  contrato: string;
  nombre: string;
  situacion: Situacion;
  firmado: boolean;
  titularId: string | null;
  titularNombre: string | null;
  /** Pagos VALIDADOS del titular de ese contrato (si >0 no se puede anular desde aquí). */
  pagosValidados: number;
  creado: string | null;
}

function esMuerto(r: any): boolean {
  const estado = String(r.estado || '').trim().toUpperCase();
  const apro = String(r.aprobacion || '').trim().toUpperCase();
  const aproTit = String(r.titularAprobacion || '').trim().toUpperCase();
  if (estado === 'FINALIZADA' || estado === 'ANULADO') return true;
  if (APROBACION_MUERTA.includes(apro) || APROBACION_MUERTA.includes(aproTit)) return true;
  // Inactivo = muerto, salvo OnHold (pausa temporal: el contrato sigue vivo).
  if (r.estadoInactivo === true && !r.fechaOnHold) return true;
  return false;
}

function situacionDe(r: any): Situacion {
  const apro = String(r.aprobacion || '').trim().toUpperCase();
  if (apro === 'APROBADO' || apro === 'APROBADA') return 'APROBADO';
  return r.firmado ? 'FIRMADO_SIN_APROBAR' : 'SIN_FIRMAR';
}

/** Registros VIVOS del documento en otros contratos (excluye `excluirContrato` y PRB-). */
export async function verificarDocumento(
  numeroId: string,
  excluirContrato?: string | null
): Promise<RegistroDocumento[]> {
  const nid = normalizeNumeroId(numeroId);
  if (!nid) return [];
  const rows = await queryMany<any>(
    `SELECT p."_id", p."tipoUsuario", p."contrato", p."primerNombre", p."primerApellido",
            p."aprobacion", p."estado", p."estadoInactivo", p."fechaOnHold", p."_createdDate",
            t."_id" AS "titularId",
            NULLIF(TRIM(CONCAT_WS(' ', t."primerNombre", t."primerApellido")), '') AS "titularNombre",
            t."aprobacion" AS "titularAprobacion",
            (COALESCE(t."hashConsentimiento", '') <> '') AS "firmado",
            COALESCE((SELECT COUNT(*) FROM "PAGOS_TITULARES" pt
                       WHERE pt."idPeople" = t."_id" AND pt."validado" IS TRUE), 0)::int AS "pagosValidados"
       FROM "PEOPLE" p
       LEFT JOIN LATERAL (
         SELECT * FROM "PEOPLE" t
          WHERE t."contrato" = p."contrato" AND t."tipoUsuario" = 'TITULAR'
          ORDER BY t."_createdDate" ASC LIMIT 1
       ) t ON true
      WHERE ${SQL_NORM.replace(/"numeroId"/g, 'p."numeroId"')} = $1
        AND COALESCE(p."contrato", '') <> ''
        AND p."contrato" NOT LIKE 'PRB-%'
        AND ($2::text IS NULL OR p."contrato" <> $2)
      ORDER BY p."_createdDate" DESC`,
    [nid, excluirContrato || null]
  );

  return rows
    .filter(r => !esMuerto(r))
    .map(r => ({
      personId: r._id,
      tipoUsuario: r.tipoUsuario,
      contrato: r.contrato,
      nombre: [r.primerNombre, r.primerApellido].filter(Boolean).join(' ').trim(),
      situacion: situacionDe(r),
      firmado: r.firmado === true,
      titularId: r.titularId ?? null,
      titularNombre: r.titularNombre ?? null,
      pagosValidados: Number(r.pagosValidados) || 0,
      creado: r._createdDate ? new Date(r._createdDate).toISOString() : null,
    }));
}

export interface ContratoPrevio {
  contrato: string;
  tipoUsuario: string;
  estado: string;          // Rechazado / Devuelto / Contrato nulo / Retractado / ANULADO
  pagosValidados: number;
}
export interface AcademicaPrevia { nivel: string | null; step: string | null; clases: number }

/**
 * Contexto INFORMATIVO (no bloquea): contratos anulados/rechazados/devueltos de
 * este documento (con sus pagos validados — el contrato nuevo NO los hereda) y su
 * ficha académica previa (clases ya tomadas). Excluye PRB- y FINALIZADA.
 */
export async function historialPrevio(numeroId: string): Promise<{ previos: ContratoPrevio[]; academica: AcademicaPrevia | null }> {
  const nid = normalizeNumeroId(numeroId);
  if (!nid) return { previos: [], academica: null };
  const previos = await queryMany<any>(
    `SELECT DISTINCT ON (p."contrato", p."tipoUsuario")
            p."contrato", p."tipoUsuario",
            COALESCE(NULLIF(p."aprobacion",''), p."estado") AS "estado",
            COALESCE((SELECT COUNT(*) FROM "PAGOS_TITULARES" pt
                       WHERE pt."validado" IS TRUE
                         AND pt."idPeople" IN (SELECT x."_id" FROM "PEOPLE" x WHERE x."contrato" = p."contrato")), 0)::int AS "pagosValidados"
       FROM "PEOPLE" p
      WHERE ${SQL_NORM.replace(/"numeroId"/g, 'p."numeroId"')} = $1
        AND COALESCE(p."contrato",'') <> '' AND p."contrato" NOT LIKE 'PRB-%'
        AND (UPPER(COALESCE(p."estado",'')) = 'ANULADO'
             OR UPPER(COALESCE(p."aprobacion",'')) IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO'))
      ORDER BY p."contrato", p."tipoUsuario"`,
    [nid]
  );
  const acad = await queryOne<any>(
    `SELECT a."nivel", a."step",
            (SELECT COUNT(*) FROM "ACADEMICA_BOOKINGS" b
              WHERE b."studentId" = a."_id" OR b."idEstudiante" = a."_id")::int AS "clases"
       FROM "ACADEMICA" a
      WHERE ${SQL_NORM.replace(/"numeroId"/g, 'a."numeroId"')} = $1
      ORDER BY a."_createdDate" DESC LIMIT 1`,
    [nid]
  );
  // Una sola entrada por contrato (puede haber sido titular Y beneficiario en él).
  const porContrato = new Map<string, ContratoPrevio>();
  for (const r of previos) {
    const prev = porContrato.get(r.contrato);
    if (prev) {
      if (!prev.tipoUsuario.includes(r.tipoUsuario)) prev.tipoUsuario = `${prev.tipoUsuario} y ${r.tipoUsuario}`;
    } else {
      porContrato.set(r.contrato, { contrato: r.contrato, tipoUsuario: r.tipoUsuario, estado: r.estado, pagosValidados: Number(r.pagosValidados) || 0 });
    }
  }
  return {
    previos: Array.from(porContrato.values()),
    academica: acad && (acad.nivel || Number(acad.clases) > 0)
      ? { nivel: acad.nivel ?? null, step: acad.step ?? null, clases: Number(acad.clases) || 0 }
      : null,
  };
}

/**
 * Datos del registro TITULAR más reciente de este documento (vivo o no), para
 * el botón "Traer sus datos" del wizard. Solo campos de contacto/perfil; nunca
 * contrato, aprobación ni datos financieros.
 */
export async function datosPreviosTitular(numeroId: string): Promise<Record<string, any> | null> {
  const nid = normalizeNumeroId(numeroId);
  if (!nid) return null;
  const r = await queryOne<any>(
    `SELECT "primerNombre","segundoNombre","primerApellido","segundoApellido","email","celular","telefono",
            "fechaNacimiento","domicilio","ciudad","genero","empresa","cargo","ingresos",
            "referenciaUno","parentezcoRefUno","telefonoRefUno","referenciaDos","parentezcoRefDos","telefonoRefDos",
            "contrato","_createdDate"
       FROM "PEOPLE"
      WHERE ${SQL_NORM} = $1 AND "tipoUsuario" = 'TITULAR' AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
      ORDER BY "_createdDate" DESC LIMIT 1`,
    [nid]
  );
  return r || null;
}
