// Migración idempotente: tabla CERTIFICADOS_LOG — historial de CADA generación de certificado
// de nivel (una fila por descarga), con su origen:
//   ESTUDIANTE = panel del estudiante (límite de 1 vez, ver CERTIFICADOS_GENERADOS)
//   ADMIN      = detalle del estudiante en el panel administrativo (sin límite)
// Fuente del informe Informes › Académica › Certificados. Backfill: las generaciones de
// alumnos ya registradas en CERTIFICADOS_GENERADOS (las de admin anteriores no quedaron guardadas).
// Dry-run por defecto; --apply para crear y cargar.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(`
      CREATE TABLE IF NOT EXISTS "CERTIFICADOS_LOG" (
        "_id"         TEXT PRIMARY KEY,
        "studentId"   TEXT NOT NULL,
        "numeroId"    TEXT,
        "nivel"       TEXT NOT NULL,
        "nombre"      TEXT,
        "origen"      TEXT NOT NULL CHECK ("origen" IN ('ESTUDIANTE','ADMIN')),
        "generadoPor" TEXT,
        "generadoEn"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await c.query(`CREATE INDEX IF NOT EXISTS "CERTIFICADOS_LOG_student_nivel_idx" ON "CERTIFICADOS_LOG" ("studentId","nivel")`);
    await c.query(`CREATE INDEX IF NOT EXISTS "CERTIFICADOS_LOG_generadoEn_idx" ON "CERTIFICADOS_LOG" ("generadoEn")`);
    const r = await c.query(`
      INSERT INTO "CERTIFICADOS_LOG" ("_id","studentId","numeroId","nivel","nombre","origen","generadoPor","generadoEn")
      SELECT 'clog_bf_' || g."_id", g."studentId", g."numeroId", g."nivel", g."nombre", 'ESTUDIANTE', 'backfill:CERTIFICADOS_GENERADOS', g."generadoEn"
        FROM "CERTIFICADOS_GENERADOS" g
       WHERE NOT EXISTS (SELECT 1 FROM "CERTIFICADOS_LOG" l WHERE l."_id" = 'clog_bf_' || g."_id")`);
    const tot = (await c.query(`SELECT "origen", COUNT(*)::int n FROM "CERTIFICADOS_LOG" GROUP BY 1`)).rows;
    console.log(`Backfill insertado: ${r.rowCount}. Totales:`, tot);
    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply.'); }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
