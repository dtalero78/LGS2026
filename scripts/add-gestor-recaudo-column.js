/**
 * One-time DDL: add PEOPLE.gestorRecaudo column to store the assigned
 * collection executive's USUARIOS_ROLES._id.
 *
 * Field type: VARCHAR(255) NULLABLE. Stores the _id (UUID) of the assigned
 * user from USUARIOS_ROLES — only users with rol IN ('RECAUDO_ASIST',
 * 'RECAUDOS_JEFE') are valid (validated at API level).
 *
 * Only applies to PEOPLE rows with tipoUsuario='TITULAR' (validated at
 * API level too).
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const before = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name='PEOPLE' AND column_name='gestorRecaudo'`
    );
    console.log('Estado previo:', before.rows[0] ? `EXISTE (${before.rows[0].data_type})` : 'NO EXISTE');

    await pool.query(
      `ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "gestorRecaudo" VARCHAR(255)`
    );

    const after = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name='PEOPLE' AND column_name='gestorRecaudo'`
    );
    console.log('Estado final:', after.rows[0] ? `OK (${after.rows[0].data_type})` : 'FALLÓ');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
