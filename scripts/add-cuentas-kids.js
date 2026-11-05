/**
 * Cuentas de guías KIDS reflejadas en LGS (fase 1: usuario y clave nacen en KIDS).
 *
 * USUARIOS_ROLES:
 *   - "username"        usuario de KIDS (p. ej. pkilson6355); se puede entrar con él o con el correo.
 *   - "origenCuenta"    'KIDS' = la cuenta la administra KIDS (LGS no cambia su clave).
 *   - "kidsUserId"      identity_user.id de KIDS.
 *   - "kidsDebeCambiar" KIDS exige cambiar la clave al próximo ingreso: LGS no deja entrar hasta hacerlo allá.
 * ADVISORS:
 *   - "kidsFotoId"      foto_file_id de KIDS ya copiada a fotoAdvisor (para no volver a bajarla).
 *
 * Uso: node scripts/add-cuentas-kids.js            (dry-run)
 *      node scripts/add-cuentas-kids.js --apply
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const SQL = [
  `ALTER TABLE "USUARIOS_ROLES" ADD COLUMN IF NOT EXISTS "username" VARCHAR(80)`,
  `ALTER TABLE "USUARIOS_ROLES" ADD COLUMN IF NOT EXISTS "origenCuenta" VARCHAR(20)`,
  `ALTER TABLE "USUARIOS_ROLES" ADD COLUMN IF NOT EXISTS "kidsUserId" VARCHAR(64)`,
  `ALTER TABLE "USUARIOS_ROLES" ADD COLUMN IF NOT EXISTS "kidsDebeCambiar" BOOLEAN`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_usuarios_roles_username" ON "USUARIOS_ROLES" (LOWER("username")) WHERE "username" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "idx_usuarios_roles_kids_user" ON "USUARIOS_ROLES" ("kidsUserId") WHERE "kidsUserId" IS NOT NULL`,
  `ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "kidsFotoId" VARCHAR(64)`,
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  if (!APPLY) {
    SQL.forEach(s => console.log(s));
    console.log('\nDry-run. Use --apply para aplicar.');
    await c.end();
    return;
  }
  await c.query('BEGIN');
  try {
    for (const s of SQL) await c.query(s);
    await c.query('COMMIT');
    console.log('✅ Columnas de cuentas KIDS listas');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
