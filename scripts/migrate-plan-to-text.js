/**
 * Migración de schema para soportar Tipo Plan (Contado/Credito/Colaborador)
 * en las 3 tablas que tienen el campo `plan`:
 *
 *   1. PEOPLE.plan          → ya es TEXT, sin cambio
 *   2. FINANCIEROS.plan     → ADD COLUMN IF NOT EXISTS plan TEXT
 *   3. PAGOS_TITULARES.plan → ALTER COLUMN INTEGER → TEXT (preserva datos)
 *
 * Idempotente: detecta el estado actual y solo aplica lo necesario.
 *
 * Modos:
 *   node scripts/migrate-plan-to-text.js           → dry-run
 *   node scripts/migrate-plan-to-text.js --apply   → ejecuta
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

async function getColumnType(pool, tableName, columnName) {
  const r = await pool.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return r.rows[0]?.data_type ?? null;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

    // ── PEOPLE.plan ──────────────────────────────────────────────
    const peopleType = await getColumnType(pool, 'PEOPLE', 'plan');
    console.log(`PEOPLE.plan: ${peopleType || '(no existe)'}`);
    if (peopleType !== 'text') {
      console.log(`  ⚠️  PEOPLE.plan no es TEXT — requeriría ALTER (esperado: text)`);
    } else {
      console.log(`  ✓ Ya es TEXT, sin cambio`);
    }

    // ── FINANCIEROS.plan ─────────────────────────────────────────
    const finType = await getColumnType(pool, 'FINANCIEROS', 'plan');
    console.log(`\nFINANCIEROS.plan: ${finType || '(no existe)'}`);
    if (!finType) {
      console.log(`  → Acción: AGREGAR columna TEXT`);
      if (APPLY) {
        await pool.query(`ALTER TABLE "FINANCIEROS" ADD COLUMN "plan" TEXT`);
        console.log(`  ✓ Columna agregada`);
      }
    } else if (finType !== 'text') {
      console.log(`  ⚠️  FINANCIEROS.plan no es TEXT (es ${finType}) — necesita conversión manual`);
    } else {
      console.log(`  ✓ Ya es TEXT, sin cambio`);
    }

    // ── PAGOS_TITULARES.plan ─────────────────────────────────────
    const ptType = await getColumnType(pool, 'PAGOS_TITULARES', 'plan');
    console.log(`\nPAGOS_TITULARES.plan: ${ptType || '(no existe)'}`);
    if (ptType === 'integer' || ptType === 'numeric' || ptType === 'bigint') {
      console.log(`  → Acción: ALTER COLUMN ${ptType} → TEXT (preserva datos)`);
      if (APPLY) {
        await pool.query(
          `ALTER TABLE "PAGOS_TITULARES" ALTER COLUMN "plan" TYPE TEXT USING "plan"::text`
        );
        console.log(`  ✓ Columna convertida a TEXT`);
      }
    } else if (ptType === 'text') {
      console.log(`  ✓ Ya es TEXT, sin cambio`);
    } else if (!ptType) {
      console.log(`  → Acción: AGREGAR columna TEXT`);
      if (APPLY) {
        await pool.query(`ALTER TABLE "PAGOS_TITULARES" ADD COLUMN "plan" TEXT`);
        console.log(`  ✓ Columna agregada`);
      }
    }

    if (!APPLY) {
      console.log(`\nDry-run. Para aplicar:\n  node scripts/migrate-plan-to-text.js --apply`);
    } else {
      console.log(`\n✓ Migración de schema completada.`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
