/* Crea MENSAJES_EVENTO_LOG (solo INSERT): bitácora de mensajes enviados a los inscritos de un evento. Idempotente. Uso: node scripts/create-mensajes-evento-log.js [--apply] */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const ya = (await c.query(`SELECT 1 FROM information_schema.tables WHERE table_name='MENSAJES_EVENTO_LOG'`)).rowCount;
  console.log(ya ? 'La tabla ya existe' : 'Falta la tabla MENSAJES_EVENTO_LOG');
  if (!ya && process.argv.includes('--apply')) {
    await c.query(`CREATE TABLE IF NOT EXISTS "MENSAJES_EVENTO_LOG" (
      "_id" TEXT PRIMARY KEY, "eventoId" TEXT NOT NULL, "eventoTitulo" TEXT, "eventoDia" TIMESTAMPTZ,
      "modo" TEXT NOT NULL, "plantillaId" TEXT, "plantillaNombre" TEXT, "texto" TEXT,
      "total" INTEGER NOT NULL, "enviados" INTEGER NOT NULL, "fallidos" INTEGER NOT NULL, "resultados" JSONB,
      "usuarioEmail" TEXT, "usuarioNombre" TEXT, "_createdDate" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await c.query(`CREATE INDEX IF NOT EXISTS idx_mensajes_evento_log_evento ON "MENSAJES_EVENTO_LOG" ("eventoId", "_createdDate" DESC)`);
    console.log('Creada');
  } else if (!ya) console.log('(dry-run — use --apply)');
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
