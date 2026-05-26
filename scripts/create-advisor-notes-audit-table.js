/**
 * Migración Ctrl Horas: auditoría de ediciones admin sobre Time Out / Notas
 * del advisor.
 *
 * CREATE TABLE ADVISOR_NOTES_AUDIT — registra cada vez que un SUPER_ADMIN o
 * ADMIN edita los campos `timeout` o `notasadvisor` de un evento ajeno (o
 * los edita después del cierre de la sesión). Las ediciones del propio
 * advisor sobre su evento NO se registran aquí (no son anómalas).
 *
 * Estructura:
 *   - eventoId        FK lógico a CALENDARIO._id
 *   - actorEmail      email del admin que edita
 *   - actorRole       SUPER_ADMIN | ADMIN
 *   - motivo          texto OBLIGATORIO (validado en el service)
 *   - timeoutBefore   snapshot antes del cambio
 *   - timeoutAfter    snapshot después
 *   - notasBefore     snapshot antes
 *   - notasAfter      snapshot después
 *   - sesionEstabaCerrada  bool — si la sesión ya estaba cerrada al editar
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + índices con IF NOT EXISTS.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    console.log('▶ CREATE ADVISOR_NOTES_AUDIT…');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ADVISOR_NOTES_AUDIT" (
        "_id"                  VARCHAR(50)  PRIMARY KEY,
        "eventoId"             VARCHAR(50)  NOT NULL,
        "advisorIdAtEdit"      VARCHAR(50),
        "actorEmail"           VARCHAR(255) NOT NULL,
        "actorRole"            VARCHAR(50)  NOT NULL,
        "motivo"               TEXT         NOT NULL,
        "timeoutBefore"        VARCHAR(5),
        "timeoutAfter"         VARCHAR(5),
        "notasBefore"          TEXT,
        "notasAfter"           TEXT,
        "sesionEstabaCerrada"  BOOLEAN      NOT NULL DEFAULT false,
        "_createdDate"         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_notes_audit_evento" ON "ADVISOR_NOTES_AUDIT" ("eventoId", "_createdDate" DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "idx_notes_audit_actor"  ON "ADVISOR_NOTES_AUDIT" ("actorEmail", "_createdDate" DESC)`);

    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name='ADVISOR_NOTES_AUDIT' ORDER BY ordinal_position`
    );
    console.log(`\n✅ ADVISOR_NOTES_AUDIT (${cols.rows.length} columnas):`);
    cols.rows.forEach(r => console.log(`   ${r.column_name}: ${r.data_type}`));
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
