/**
 * fix-onhold-cron-stale-estado-login.js
 *
 * Repara los estudiantes que el cron `reactivate-onhold` reactivó dejándolos
 * en un estado inconsistente (bug del cron, corregido en el código):
 *   - PEOPLE.estado quedó pegado en 'On Hold' aunque estadoInactivo=false.
 *   - USUARIOS_ROLES.activo quedó en false → el estudiante NO podía hacer login
 *     pese a estar reactivado y con contrato vigente.
 *
 * Acciones (idempotentes):
 *   1) estado: PEOPLE SET estado='ACTIVA' WHERE estado='On Hold' AND estadoInactivo=false.
 *   2) login : USUARIOS_ROLES SET activo=true (rol ESTUDIANTE) para esos estudiantes
 *              cuyo contrato NO esté vencido (finalContrato >= hoy).
 *
 * NO toca finalContrato/extensionCount/extensionHistory (las extensiones por
 * días pausados ya aplicadas se conservan).
 *
 * Uso:
 *   node scripts/fix-onhold-cron-stale-estado-login.js            # dry-run
 *   node scripts/fix-onhold-cron-stale-estado-login.js --apply    # aplica
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // Afectados: estado stale 'On Hold' con estudiante ya reactivado.
  const rows = (await c.query(`
    SELECT p."_id", p."primerNombre", p."primerApellido", p."numeroId", p."contrato",
           p."email", p."estado", p."estadoInactivo",
           p."finalContrato"::date AS "finalContrato",
           (p."finalContrato"::date >= CURRENT_DATE) AS "contratoVigente",
           u."_id" AS "urId", u."activo" AS "loginActivo"
    FROM "PEOPLE" p
    LEFT JOIN "USUARIOS_ROLES" u
      ON LOWER(TRIM(u."email")) = LOWER(TRIM(p."email")) AND u."rol" = 'ESTUDIANTE'
    WHERE p."estado" = 'On Hold' AND p."estadoInactivo" = false
    ORDER BY p."primerApellido"
  `)).rows;

  const estadoFix = rows; // todos: estado stale → 'ACTIVA'
  const loginFix = rows.filter(r => r.urId && r.loginActivo === false && r.contratoVigente);
  const loginSkipExpired = rows.filter(r => r.urId && r.loginActivo === false && !r.contratoVigente);

  console.log(`\n=== Afectados (estado='On Hold' + estadoInactivo=false): ${rows.length} ===`);
  rows.forEach(r => {
    const login = r.urId ? (r.loginActivo ? 'login=ON' : 'login=OFF') : 'sin USUARIOS_ROLES';
    const venc = r.contratoVigente ? 'vigente' : 'VENCIDO';
    console.log(`  ${r.numeroId} | ${r.primerNombre} ${r.primerApellido} | ${r.contrato} | final ${r.finalContrato} (${venc}) | ${login}`);
  });

  console.log(`\nPlan:`);
  console.log(`  • estado 'On Hold' → 'ACTIVA':            ${estadoFix.length}`);
  console.log(`  • login activo=false → true (vigentes):   ${loginFix.length}`);
  if (loginSkipExpired.length) {
    console.log(`  • login OMITIDO por contrato VENCIDO:      ${loginSkipExpired.length}`);
    loginSkipExpired.forEach(r => console.log(`      - ${r.numeroId} ${r.primerNombre} ${r.primerApellido} (final ${r.finalContrato})`));
  }

  if (!APPLY) {
    console.log(`\n[dry-run] No se escribió nada. Re-corre con --apply para aplicar.`);
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    let est = 0, log = 0;
    for (const r of estadoFix) {
      const res = await c.query(
        `UPDATE "PEOPLE" SET "estado"='ACTIVA', "_updatedDate"=NOW()
         WHERE "_id"=$1 AND "estado"='On Hold' AND "estadoInactivo"=false`,
        [r._id]
      );
      est += res.rowCount;
    }
    for (const r of loginFix) {
      const res = await c.query(
        `UPDATE "USUARIOS_ROLES" SET "activo"=true, "_updatedDate"=NOW()
         WHERE "_id"=$1 AND "activo"=false`,
        [r.urId]
      );
      log += res.rowCount;
    }
    await c.query('COMMIT');
    console.log(`\n[APLICADO] estado actualizado: ${est} · login restaurado: ${log}`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK por error:', e.message);
    process.exit(1);
  }
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
