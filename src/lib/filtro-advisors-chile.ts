import 'server-only';
import { query, queryOne, queryMany } from '@/lib/postgres';

/**
 * Filtro TEMPORAL (capacitación del 2026-10-09): para los usuarios configurados
 * (hoy Mabel Nuñez), la Tabla de Asistencia del beneficiario y los informes con
 * advisors (Advisors, Resumen, Programación, Horas Advisor, Usuarios, InfoAcademic)
 * muestran SOLO clases/advisors de Chile, excepto Joseph Miguel Machado Acosta.
 * Las demás filas no se envían a esa sesión; KPIs y gráficas se calculan sobre lo filtrado.
 *
 * No modifica datos: solo filtra lo que se muestra. Se enciende/apaga en
 * /admin/filtro-advisors-chile (APP_CONFIG `filtro_advisors_chile`, JSON
 * { activo, emails }). La tabla muestra "Mostrando clases con advisors de Chile".
 */

const KEY = 'filtro_advisors_chile';
const EMAILS_DEFAULT = ['m.nunez@letsgospeak.cl'];
/** Advisor de Chile excluido del filtro (por nombre). */
const EXCLUIDO = '%machado acosta%';

export interface FiltroConfig { activo: boolean; emails: string[] }

let cacheCfg: { at: number; cfg: FiltroConfig } | null = null;
let cacheAdv: { at: number; ids: string[]; keys: Set<string> } | null = null;
const TTL = 60_000;

export async function getFiltroConfig(force = false): Promise<FiltroConfig> {
  if (!force && cacheCfg && Date.now() - cacheCfg.at < TTL) return cacheCfg.cfg;
  let cfg: FiltroConfig = { activo: false, emails: EMAILS_DEFAULT };
  try {
    const row = await queryOne<{ value: string }>(`SELECT "value" FROM "APP_CONFIG" WHERE "key" = $1`, [KEY]);
    if (row?.value) {
      const v = JSON.parse(row.value);
      cfg = { activo: v.activo === true, emails: Array.isArray(v.emails) && v.emails.length ? v.emails : EMAILS_DEFAULT };
    }
  } catch { /* sin config → apagado */ }
  cacheCfg = { at: Date.now(), cfg };
  return cfg;
}

export async function setFiltroActivo(activo: boolean, por: string): Promise<FiltroConfig> {
  const actual = await getFiltroConfig(true);
  const cfg: FiltroConfig = { ...actual, activo };
  await query(
    `INSERT INTO "APP_CONFIG" ("key","value","updatedBy","_updatedDate") VALUES ($1,$2,$3,NOW())
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedBy" = EXCLUDED."updatedBy", "_updatedDate" = NOW()`,
    [KEY, JSON.stringify(cfg), por]);
  cacheCfg = { at: Date.now(), cfg };
  return cfg;
}

/** ¿El filtro aplica a este usuario ahora? */
export async function filtroAplica(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const cfg = await getFiltroConfig();
  return cfg.activo && cfg.emails.some(e => e.trim().toLowerCase() === email.trim().toLowerCase());
}

/** Advisors permitidos (Chile, excepto el excluido): sus `_id` y claves id/email/nombre en minúscula. */
async function advisorsPermitidos(): Promise<{ ids: string[]; keys: Set<string> }> {
  if (cacheAdv && Date.now() - cacheAdv.at < TTL) return cacheAdv;
  const rows = await queryMany<{ _id: string; email: string | null; nombreCompleto: string | null }>(
    `SELECT "_id", "email", "nombreCompleto" FROM "ADVISORS"
      WHERE LOWER(TRIM(COALESCE("pais",''))) = 'chile' AND COALESCE("nombreCompleto",'') NOT ILIKE $1`, [EXCLUIDO]);
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of [r._id, r.email, r.nombreCompleto]) if (k) keys.add(String(k).trim().toLowerCase());
  }
  cacheAdv = { at: Date.now(), ids: rows.map(r => r._id), keys };
  return cacheAdv;
}

/**
 * Para los informes con SQL sobre ADVISORS: si el filtro aplica a la sesión,
 * devuelve los `_id` de advisors permitidos (usar `adv."_id" = ANY($n)`); si no, null.
 */
export async function advisorIdsFiltro(session: any): Promise<string[] | null> {
  if (!(await filtroAplica(session?.user?.email))) return null;
  return (await advisorsPermitidos()).ids;
}

/** ¿Este valor (id, email o nombre de advisor) es de un advisor permitido? */
export async function esAdvisorPermitido(valor: any): Promise<boolean> {
  const v = String(valor ?? '').trim().toLowerCase();
  return !!v && (await advisorsPermitidos()).keys.has(v);
}

/** Deja solo las clases cuyo advisor es de Chile (excepto el excluido). */
export async function filtrarClasesPorAdvisorChile<T extends { advisor?: any; advisorNombre?: any }>(clases: T[]): Promise<T[]> {
  const { keys } = await advisorsPermitidos();
  return clases.filter(c => {
    const a = String(c.advisor ?? '').trim().toLowerCase();
    const n = String((c as any).advisorNombre ?? '').trim().toLowerCase();
    return (a && keys.has(a)) || (n && keys.has(n));
  });
}
