#!/usr/bin/env node
/**
 * normalize-estado-extensiones.js — normaliza PEOPLE.estado + estadoInactivo
 * de los contratos CON EXTENSIÓN (extensionCount > 0).
 *
 * Regla (misma ventana de expiración que el cron / contract-expiry.ts:
 * vencido ⇔ finalContrato < CURRENT_DATE - 1 día, en UTC):
 *
 *   A) VENCIDO  → estado = 'FINALIZADA',    estadoInactivo = true
 *   B) VIGENTE y ACTIVO (estadoInactivo NULL/false)
 *               → estado = 'CON EXTENSION', estadoInactivo = false
 *
 * Criterio de seguridad: se usa `estadoInactivo` (NO `aprobacion`, que queda
 * stale tras una extensión que revive un contrato ya finalizado).
 *
 * NO se tocan (se reportan para revisión manual):
 *   - Cualquier contrato en OnHold genuino (fechaOnHold IS NOT NULL).
 *   - VIGENTE con estadoInactivo = true (inactivo a propósito: anulado,
 *     suspendido, etc.) — no se reactiva automáticamente.
 *
 * Solo toca PEOPLE (estado + estadoInactivo). Idempotente (solo actualiza filas
 * que aún no están en el estado correcto). Dry-run por defecto; --apply escribe
 * en transacción.
 * USO: node scripts/normalize-estado-extensiones.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

const EXT = `COALESCE("extensionCount",0) > 0`;
const VENCIDO = `"finalContrato" IS NOT NULL AND "finalContrato" < (CURRENT_DATE - INTERVAL '1 day')`;
const VIGENTE = `"finalContrato" IS NOT NULL AND "finalContrato" >= (CURRENT_DATE - INTERVAL '1 day')`;
const NO_ONHOLD = `"fechaOnHold" IS NULL`;
const ACTIVO = `("estadoInactivo" IS NULL OR "estadoInactivo" = false)`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== NORMALIZAR estado de extensiones (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const vencCount = (await c.query(
    `SELECT COUNT(*)::int n FROM "PEOPLE"
      WHERE ${EXT} AND ${VENCIDO} AND ${NO_ONHOLD}
        AND ("estado" IS DISTINCT FROM 'FINALIZADA' OR "estadoInactivo" IS DISTINCT FROM true)`)).rows[0].n;
  const vigCount = (await c.query(
    `SELECT COUNT(*)::int n FROM "PEOPLE"
      WHERE ${EXT} AND ${VIGENTE} AND ${NO_ONHOLD} AND ${ACTIVO}
        AND ("estado" IS DISTINCT FROM 'CON EXTENSION' OR "estadoInactivo" IS DISTINCT FROM false)`)).rows[0].n;

  // No se tocan — reporte
  const vigInactivos = (await c.query(
    `SELECT COALESCE("estado",'(null)') AS estado, COALESCE("aprobacion",'(null)') AS aprobacion, COUNT(*)::int AS n
       FROM "PEOPLE" WHERE ${EXT} AND ${VIGENTE} AND ${NO_ONHOLD} AND "estadoInactivo" = true
      GROUP BY 1,2 ORDER BY 3 DESC`)).rows;
  const onHold = (await c.query(
    `SELECT CASE WHEN ${VENCIDO} THEN 'VENCIDO' ELSE 'VIGENTE' END AS ventana, COUNT(*)::int AS n
       FROM "PEOPLE" WHERE ${EXT} AND "fechaOnHold" IS NOT NULL GROUP BY 1`)).rows;

  console.log(`\nA) VENCIDO → FINALIZADA + inactivo:      ${vencCount} fila(s) a cambiar`);
  console.log(`B) VIGENTE activo → CON EXTENSION+activo: ${vigCount} fila(s) a cambiar`);
  console.log(`\nNO se tocan (revisión manual):`);
  console.log(`  · VIGENTE inactivos (estadoInactivo=true):`, vigInactivos.length ? vigInactivos : '(ninguno)');
  console.log(`  · En OnHold:`, onHold.length ? onHold : '(ninguno)');

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para escribir`); await c.end(); return; }

  await c.query('BEGIN');
  try {
    const rV = await c.query(
      `UPDATE "PEOPLE"
          SET "estado"='FINALIZADA', "estadoInactivo"=true, "_updatedDate"=NOW()
        WHERE ${EXT} AND ${VENCIDO} AND ${NO_ONHOLD}
          AND ("estado" IS DISTINCT FROM 'FINALIZADA' OR "estadoInactivo" IS DISTINCT FROM true)`);
    const rG = await c.query(
      `UPDATE "PEOPLE"
          SET "estado"='CON EXTENSION', "estadoInactivo"=false, "_updatedDate"=NOW()
        WHERE ${EXT} AND ${VIGENTE} AND ${NO_ONHOLD} AND ${ACTIVO}
          AND ("estado" IS DISTINCT FROM 'CON EXTENSION' OR "estadoInactivo" IS DISTINCT FROM false)`);
    await c.query('COMMIT');
    console.log(`\n✔ VENCIDO: ${rV.rowCount} fila(s) · VIGENTE: ${rG.rowCount} fila(s)`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  const dist = (await c.query(
    `SELECT CASE WHEN ${VENCIDO} THEN 'VENCIDO' ELSE 'VIGENTE' END AS ventana,
            COALESCE("estado",'(null)') AS estado, "estadoInactivo", COUNT(*)::int AS n
     FROM "PEOPLE" WHERE ${EXT}
     GROUP BY 1,2,3 ORDER BY 1,4 DESC`)).rows;
  console.log(`\nDistribución final (extensionCount>0):`);
  dist.forEach(r => console.log(`  ${r.ventana.padEnd(8)} · ${String(r.estado).padEnd(22)} · inactivo=${r.estadoInactivo} · ${r.n}`));
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
