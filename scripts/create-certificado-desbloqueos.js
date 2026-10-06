// Migración idempotente: tabla CERTIFICADO_DESBLOQUEOS (desbloqueo manual del certificado
// por mora, hecho por Recaudos desde Recaudos › Usuarios en mora). Unidad = contrato:
// un desbloqueo ACTIVO de un contrato habilita el certificado a todos sus beneficiarios
// aunque el cálculo lo marque en mora. Revocar = activo=false (nunca se borra: auditoría).
// Dry-run por defecto; --apply para crear.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');
const DDL = [
  `CREATE TABLE IF NOT EXISTS "CERTIFICADO_DESBLOQUEOS" (
     "_id"                  TEXT PRIMARY KEY,
     "contrato"             TEXT NOT NULL,
     "titularId"            TEXT,
     "titularNombre"        TEXT,
     "motivo"               TEXT NOT NULL,
     "activo"               BOOLEAN NOT NULL DEFAULT true,
     "desbloqueadoPor"      TEXT,
     "desbloqueadoPorNombre" TEXT,
     "revocadoPor"          TEXT,
     "revocadoEn"           TIMESTAMPTZ,
     "_createdDate"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CERTIFICADO_DESBLOQUEOS_contrato_activo_uidx"
     ON "CERTIFICADO_DESBLOQUEOS" ("contrato") WHERE "activo"`,
];
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const q of DDL) await c.query(q);
    const n = (await c.query(`SELECT COUNT(*)::int n FROM "CERTIFICADO_DESBLOQUEOS"`)).rows[0].n;
    console.log(`CERTIFICADO_DESBLOQUEOS OK (${n} filas)`);
    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply.'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
