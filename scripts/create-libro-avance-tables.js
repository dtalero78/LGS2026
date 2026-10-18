/**
 * create-libro-avance-tables.js
 *
 * Tablas de avance por estudiante de los libros con actividades (hoy: "Book ESS
 * New", libro ST00-00 de ESSENTIAL). Genéricas por `bookCode` + `contentVersion`
 * para reutilizarlas en libros futuros.
 *
 *   LIBRO_PAGINAS_VISTAS       → una fila por estudiante/libro/versión/página vista
 *   LIBRO_INTENTOS             → cada intento calificado en el servidor (todos se conservan)
 *   LIBRO_RESPUESTAS_ABIERTAS  → respuestas escritas (revisión docente, sin nota automática)
 *
 * `studentId` = ACADEMICA._id (igual que el resto del panel del estudiante).
 *
 * Uso:
 *   node scripts/create-libro-avance-tables.js          # dry-run: muestra el SQL
 *   node scripts/create-libro-avance-tables.js --apply  # crea (idempotente)
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

const SQL = [
  `CREATE TABLE IF NOT EXISTS "LIBRO_PAGINAS_VISTAS" (
     "_id"            VARCHAR(64) PRIMARY KEY,
     "studentId"      VARCHAR(64) NOT NULL,
     "numeroId"       VARCHAR(64),
     "bookCode"       VARCHAR(32) NOT NULL,
     "contentVersion" VARCHAR(16) NOT NULL,
     "pageId"         VARCHAR(64) NOT NULL,
     "vistaEn"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE ("studentId", "bookCode", "contentVersion", "pageId")
   )`,
  `CREATE TABLE IF NOT EXISTS "LIBRO_INTENTOS" (
     "_id"            VARCHAR(64) PRIMARY KEY,
     "requestId"      VARCHAR(64) NOT NULL UNIQUE,
     "studentId"      VARCHAR(64) NOT NULL,
     "numeroId"       VARCHAR(64),
     "bookCode"       VARCHAR(32) NOT NULL,
     "contentVersion" VARCHAR(16) NOT NULL,
     "assessmentId"   VARCHAR(64) NOT NULL,
     "correctas"      INTEGER NOT NULL,
     "total"          INTEGER NOT NULL,
     "aprobado"       BOOLEAN NOT NULL,
     "respuestas"     JSONB NOT NULL,
     "creadoEn"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_libro_intentos_alumno"
     ON "LIBRO_INTENTOS" ("studentId", "bookCode", "assessmentId")`,
  `CREATE TABLE IF NOT EXISTS "LIBRO_RESPUESTAS_ABIERTAS" (
     "_id"               VARCHAR(64) PRIMARY KEY,
     "studentId"         VARCHAR(64) NOT NULL,
     "numeroId"          VARCHAR(64),
     "bookCode"          VARCHAR(32) NOT NULL,
     "contentVersion"    VARCHAR(16) NOT NULL,
     "activityId"        VARCHAR(64) NOT NULL,
     "texto"             TEXT NOT NULL,
     "creadoEn"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "actualizadoEn"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "revisadoPor"       VARCHAR(255),
     "revisadoEn"        TIMESTAMPTZ,
     "comentarioDocente" TEXT,
     UNIQUE ("studentId", "bookCode", "contentVersion", "activityId")
   )`,
];

(async () => {
  if (!APPLY) {
    console.log('DRY-RUN — SQL que se ejecutaría (use --apply):\n');
    SQL.forEach((s) => console.log(s + ';\n'));
    return;
  }
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const s of SQL) await c.query(s);
    await c.query('COMMIT');
    const r = await c.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('LIBRO_PAGINAS_VISTAS','LIBRO_INTENTOS','LIBRO_RESPUESTAS_ABIERTAS') ORDER BY 1`);
    console.log('✅ Tablas presentes:', r.rows.map((x) => x.table_name).join(', '));
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
