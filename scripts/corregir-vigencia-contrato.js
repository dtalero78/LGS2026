/**
 * corregir-vigencia-contrato.js
 *
 * Corrige la vigencia con la que NACIÓ un contrato (error de digitación al crearlo,
 * p. ej. 1 mes en vez de 12). No es una extensión: recalcula todo desde fechaContrato.
 *
 *  - PEOPLE (titular + beneficiarios del contrato): vigencia = meses,
 *    finalContrato = fechaContrato + meses y finalContratoOriginal = lo mismo
 *    (la original estaba mal desde el origen; solo con --corregir-original).
 *  - FINANCIEROS.vigencia del contrato.
 *  - Si el cron lo había FINALIZADO por la fecha errada y la nueva fecha sigue vigente:
 *    estado ACTIVA + estadoInactivo=false (PEOPLE), ACADEMICA activa y login ESTUDIANTE
 *    de los beneficiarios reactivado. Solo si el contrato está Aprobado.
 *  - Deja rastro en CONTRATO_EVENTOS (categoría VIGENCIA) → Seguimiento del contrato.
 *
 *   node scripts/corregir-vigencia-contrato.js --contrato 01-16356-26 --meses 12 --motivo "..." [--corregir-original] [--apply]
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
const crypto = require('crypto');

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes('--apply');
const ORIGINAL = process.argv.includes('--corregir-original');
const CONTRATO = arg('--contrato');
const MESES = parseInt(arg('--meses'), 10);
const MOTIVO = (arg('--motivo') || '').trim();

(async () => {
  if (!CONTRATO || !(MESES >= 1 && MESES <= 12)) throw new Error('Uso: --contrato X --meses 1..12 --motivo "..."');
  if (MOTIVO.length < 10) throw new Error('--motivo obligatorio (mínimo 10 caracteres)');
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const ppl = (await c.query(
      `SELECT "_id","tipoUsuario","primerNombre","primerApellido","numeroId","email","aprobacion","estado","estadoInactivo","fechaOnHold",
              "vigencia","fechaContrato"::date AS inicio,"finalContrato","finalContratoOriginal",
              ("fechaContrato"::date + make_interval(months => $2))::date AS nuevo_final
         FROM "PEOPLE" WHERE "contrato" = $1 ORDER BY "tipoUsuario" DESC`, [CONTRATO, MESES])).rows;
    if (!ppl.length) throw new Error(`No existe el contrato ${CONTRATO}`);
    const tit = ppl.find((p) => p.tipoUsuario === 'TITULAR');
    if (!tit) throw new Error('El contrato no tiene titular');
    if (ppl.some((p) => !p.inicio)) throw new Error('Hay personas sin fechaContrato: no se puede recalcular');
    const hoy = new Date().toISOString().slice(0, 10);
    const d = (x) => (x ? new Date(x).toISOString().slice(0, 10) : null);
    const reactivar = (p) => tit.aprobacion === 'Aprobado' && p.estado === 'FINALIZADA' && !p.fechaOnHold && d(p.nuevo_final) >= hoy;

    console.table(ppl.map((p) => ({
      tipo: p.tipoUsuario, nombre: `${p.primerNombre} ${p.primerApellido}`, vigencia: `${p.vigencia} → ${MESES}`,
      final: `${d(p.finalContrato)} → ${d(p.nuevo_final)}`,
      original: ORIGINAL ? `${d(p.finalContratoOriginal)} → ${d(p.nuevo_final)}` : `${d(p.finalContratoOriginal)} (sin cambio)`,
      estado: reactivar(p) ? `${p.estado} → ACTIVA` : p.estado, inactivo: reactivar(p) ? `${p.estadoInactivo} → false` : p.estadoInactivo,
    })));
    const fin = (await c.query(`SELECT "_id","vigencia" FROM "FINANCIEROS" WHERE "contrato" = $1`, [CONTRATO])).rows;
    console.log('FINANCIEROS:', fin.map((f) => `${f._id} vigencia ${f.vigencia} → ${MESES}`).join(', ') || '(ninguno)');
    const benReact = ppl.filter((p) => p.tipoUsuario === 'BENEFICIARIO' && reactivar(p));
    const ids = benReact.map((p) => p.numeroId);
    const emails = benReact.map((p) => (p.email || '').trim().toLowerCase()).filter(Boolean);
    const acad = ids.length ? (await c.query(`SELECT "_id","numeroId","estadoInactivo" FROM "ACADEMICA" WHERE "numeroId" = ANY($1)`, [ids])).rows : [];
    const logins = emails.length ? (await c.query(`SELECT "_id","email","activo" FROM "USUARIOS_ROLES" WHERE LOWER(TRIM("email")) = ANY($1) AND "rol" = 'ESTUDIANTE'`, [emails])).rows : [];
    console.log('ACADEMICA a reactivar:', acad.filter((a) => a.estadoInactivo).map((a) => a._id).join(', ') || '(ninguna)');
    console.log('Login ESTUDIANTE a reactivar:', logins.filter((u) => !u.activo).map((u) => u.email).join(', ') || '(ninguno)');
    if (!APPLY) { console.log('(dry-run — use --apply para escribir)'); return; }

    await c.query('BEGIN');
    try {
      for (const p of ppl) {
        const r = reactivar(p);
        await c.query(
          `UPDATE "PEOPLE" SET "vigencia" = $2, "finalContrato" = $3::date,
                  "finalContratoOriginal" = CASE WHEN $4 THEN $3::date ELSE "finalContratoOriginal" END,
                  "estado" = CASE WHEN $5 THEN 'ACTIVA' ELSE "estado" END,
                  "estadoInactivo" = CASE WHEN $5 THEN false ELSE "estadoInactivo" END
            WHERE "_id" = $1`, [p._id, String(MESES), d(p.nuevo_final), ORIGINAL, r]);
      }
      await c.query(`UPDATE "FINANCIEROS" SET "vigencia" = $2, "_updatedDate" = NOW() WHERE "contrato" = $1`, [CONTRATO, String(MESES)]);
      for (const a of acad) if (a.estadoInactivo) await c.query(`UPDATE "ACADEMICA" SET "estadoInactivo" = false WHERE "_id" = $1`, [a._id]);
      for (const u of logins) if (!u.activo) await c.query(`UPDATE "USUARIOS_ROLES" SET "activo" = true, "_updatedDate" = NOW() WHERE "_id" = $1`, [u._id]);
      await c.query(
        `INSERT INTO "CONTRATO_EVENTOS" ("_id","titularId","contrato","personaId","personaNombre","tipoUsuario","categoria","accion","detalle","datos","usuarioEmail","usuarioNombre","usuarioRol","_createdDate")
         VALUES ($1,$2,$3,$2,$4,'TITULAR','VIGENCIA','CORRECCION_VIGENCIA',$5,$6,'sistema@script','Script corregir-vigencia-contrato','SISTEMA',NOW())`,
        [crypto.randomUUID(), tit._id, CONTRATO, `${tit.primerNombre} ${tit.primerApellido}`,
         `Vigencia corregida de ${tit.vigencia} a ${MESES} meses. ${MOTIVO}`,
         JSON.stringify({ cambios: ppl.map((p) => ({ personaId: p._id, tipo: p.tipoUsuario,
           antes: { vigencia: p.vigencia, finalContrato: d(p.finalContrato), finalContratoOriginal: d(p.finalContratoOriginal), estado: p.estado, estadoInactivo: p.estadoInactivo },
           despues: { vigencia: String(MESES), finalContrato: d(p.nuevo_final), estado: reactivar(p) ? 'ACTIVA' : p.estado } })) })]);
      await c.query('COMMIT');
      console.log('✅ Vigencia corregida.');
    } catch (e) { await c.query('ROLLBACK'); throw e; }
  } finally { await c.end(); }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
