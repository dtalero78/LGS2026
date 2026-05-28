/**
 * Idempotente. Crea la relación formal ADVISORS -> USUARIOS_ROLES (análoga a
 * ACADEMICA.usuarioId -> PEOPLE._id):
 *   1) ADVISORS."usuarioRolId" VARCHAR(255)  (ADD COLUMN IF NOT EXISTS)
 *   2) Backfill: por cada advisor sin usuarioRolId, enlaza al USUARIOS_ROLES
 *      que coincide por email (DISTINCT ON LOWER(email), prefiere rol='ADVISOR'
 *      y el _updatedDate más reciente).
 *
 * Uso:  node scripts/add-advisor-usuariorol-relation.js [--apply]
 *       (sin --apply: dry-run, muestra cobertura sin escribir)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log(APPLY ? '── MODO APPLY ──\n' : '── DRY-RUN (usa --apply para escribir) ──\n');

    // 1) Columna
    await client.query(`ALTER TABLE "ADVISORS" ADD COLUMN IF NOT EXISTS "usuarioRolId" VARCHAR(255)`);
    console.log('✓ Columna ADVISORS.usuarioRolId asegurada');

    // Cobertura previa
    const before = await client.query(`
      SELECT COUNT(*)::int total,
             COUNT(*) FILTER (WHERE "usuarioRolId" IS NOT NULL)::int linked
      FROM "ADVISORS"`);
    console.log(`Advisors: ${before.rows[0].total} | ya enlazados: ${before.rows[0].linked}`);

    // Cuántos se pueden enlazar por email
    const matchable = await client.query(`
      SELECT COUNT(*)::int n FROM "ADVISORS" a
      WHERE (a."usuarioRolId" IS NULL OR a."usuarioRolId" = '')
        AND EXISTS (SELECT 1 FROM "USUARIOS_ROLES" u WHERE LOWER(u."email") = LOWER(a."email"))`);
    console.log(`Pendientes enlazables por email: ${matchable.rows[0].n}`);

    // Advisors sin match en USUARIOS_ROLES (quedarán NULL)
    const noMatch = await client.query(`
      SELECT a."email" FROM "ADVISORS" a
      WHERE (a."usuarioRolId" IS NULL OR a."usuarioRolId" = '')
        AND NOT EXISTS (SELECT 1 FROM "USUARIOS_ROLES" u WHERE LOWER(u."email") = LOWER(a."email"))`);
    if (noMatch.rowCount) {
      console.log(`Sin cuenta en USUARIOS_ROLES (${noMatch.rowCount}): ${noMatch.rows.map(r => r.email).join(', ')}`);
    }

    if (APPLY) {
      const res = await client.query(`
        UPDATE "ADVISORS" a
        SET "usuarioRolId" = sub."_id", "_updatedDate" = NOW()
        FROM (
          SELECT DISTINCT ON (LOWER(email)) LOWER(email) AS em, "_id"
          FROM "USUARIOS_ROLES"
          WHERE email IS NOT NULL AND email <> ''
          ORDER BY LOWER(email),
                   (CASE WHEN "rol" = 'ADVISOR' THEN 0 ELSE 1 END),
                   "_updatedDate" DESC NULLS LAST
        ) sub
        WHERE LOWER(a."email") = sub.em
          AND (a."usuarioRolId" IS NULL OR a."usuarioRolId" = '')`);
      console.log(`\n✅ Backfill: ${res.rowCount} advisors enlazados`);

      const after = await client.query(`
        SELECT COUNT(*) FILTER (WHERE "usuarioRolId" IS NOT NULL)::int linked,
               COUNT(*)::int total FROM "ADVISORS"`);
      console.log(`Estado final: ${after.rows[0].linked}/${after.rows[0].total} enlazados`);
    } else {
      console.log('\n(dry-run) No se escribió. Ejecuta con --apply para backfillear.');
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
