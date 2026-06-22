#!/usr/bin/env node
/**
 * backfill-beneficiario-titularid.js — Rellena `titularId` (y `inicioContrato`
 * si está null) en los BENEFICIARIOS que quedaron sin `titularId` (típicamente
 * los agregados vía "Agregar Beneficiario" / createNewBeneficiario, que antes no
 * lo seteaba).
 *
 * Matchea el TITULAR del mismo `contrato` (DISTINCT ON por contrato, el más
 * antiguo). Idempotente: solo toca filas con `titularId IS NULL`.
 *
 * USO:
 *   node scripts/backfill-beneficiario-titularid.js            # dry-run
 *   node scripts/backfill-beneficiario-titularid.js --apply    # aplica
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();

  // Beneficiarios sin titularId que SÍ tienen un titular en su contrato (candidatos reales)
  const cand = await c.query(`
    SELECT COUNT(*)::int n
    FROM "PEOPLE" b
    WHERE b."tipoUsuario" = 'BENEFICIARIO' AND b."titularId" IS NULL AND b."contrato" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "PEOPLE" t WHERE t."contrato" = b."contrato" AND t."tipoUsuario" = 'TITULAR')`);
  const total = await c.query(`SELECT COUNT(*)::int n FROM "PEOPLE" WHERE "tipoUsuario"='BENEFICIARIO' AND "titularId" IS NULL`);
  console.log(`Beneficiarios sin titularId: ${total.rows[0].n}`);
  console.log(`  → con titular en su contrato (se rellenarán): ${cand.rows[0].n}`);
  console.log(`  → sin titular en su contrato (quedan igual): ${total.rows[0].n - cand.rows[0].n}`);

  if (!APPLY) {
    console.log('\n🟡 DRY-RUN. Para aplicar: node scripts/backfill-beneficiario-titularid.js --apply');
    await c.end();
    return;
  }

  const upd = await c.query(`
    UPDATE "PEOPLE" b
    SET "titularId" = sub.tid,
        "inicioContrato" = COALESCE(b."inicioContrato", sub.inicio),
        "_updatedDate" = NOW()
    FROM (
      SELECT DISTINCT ON ("contrato") "contrato",
             "_id" AS tid,
             COALESCE("inicioContrato", "fechaContrato") AS inicio
      FROM "PEOPLE" WHERE "tipoUsuario" = 'TITULAR' AND "contrato" IS NOT NULL
      ORDER BY "contrato", "_createdDate"
    ) sub
    WHERE b."tipoUsuario" = 'BENEFICIARIO' AND b."titularId" IS NULL AND b."contrato" = sub."contrato"`);
  console.log(`\n🟢 APPLY: beneficiarios actualizados: ${upd.rowCount}`);

  const rest = await c.query(`SELECT COUNT(*)::int n FROM "PEOPLE" WHERE "tipoUsuario"='BENEFICIARIO' AND "titularId" IS NULL`);
  console.log(`Verificación → beneficiarios sin titularId restantes: ${rest.rows[0].n} (sin titular en su contrato)`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
