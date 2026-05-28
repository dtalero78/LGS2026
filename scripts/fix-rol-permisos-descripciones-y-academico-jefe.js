/**
 * Idempotente. Dos tareas sobre ROL_PERMISOS:
 *  1) Corrige descripciones erroneas/desactualizadas (quita conteos hardcodeados
 *     que ya no cuadran y arregla las 2 cruzadas: COORDINADOR_ACADEMICO y RECAUDOS_JEFE).
 *  2) Crea el rol ACADEMICO_JEFE ("Director programas academico", activo) copiando
 *     EXACTAMENTE los permisos de COORDINADOR_ACADEMICO.
 *
 * Mantiene en sync las 4 columnas de fecha (_createdDate/_updatedDate +
 * fechaCreacion/fechaActualizacion legacy).
 *
 * Uso:  node scripts/fix-rol-permisos-descripciones-y-academico-jefe.js [--apply]
 *       (sin --apply hace dry-run: muestra que cambiaria sin escribir)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

// rol -> descripcion corregida (sin conteo hardcodeado)
const DESCRIPCIONES = {
  SUPER_ADMIN:           'Acceso total al sistema - Todos los permisos',
  ADMIN:                 'Administrador con permisos amplios (sin eliminar personas)',
  ADVISOR:               'Advisor - Gestión académica y seguimiento de estudiantes',
  COMERCIAL:             'Comercial - Gestión de contratos y prospectos',
  COORDINADOR_ACADEMICO: 'Coordinador Académico - Gestión académica completa',
  READONLY:              'Solo lectura - Acceso mínimo al sistema',
  RECAUDOS_JEFE:         'Jefatura de Recaudos - Gestión y validación de pagos',
  SERVICIO_JEFE:         'Servicio - Gestión de eventos y usuarios',
  TALERO:                'Talero - Solo puede ver lista de advisors',
};

const NUEVO_ROL = 'ACADEMICO_JEFE';
const NUEVA_DESC = 'Director programas academico';
const COPIAR_DE = 'COORDINADOR_ACADEMICO';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log(APPLY ? '── MODO APPLY (escribe en BD) ──\n' : '── DRY-RUN (sin escribir; usa --apply) ──\n');
    await client.query('BEGIN');

    // 1) Descripciones
    console.log('1) Descripciones:');
    for (const [rol, desc] of Object.entries(DESCRIPCIONES)) {
      const cur = await client.query(`SELECT "descripcion" FROM "ROL_PERMISOS" WHERE "rol" = $1`, [rol]);
      if (cur.rowCount === 0) { console.log(`   - ${rol}: (no existe, skip)`); continue; }
      const antes = cur.rows[0].descripcion;
      if (antes === desc) { console.log(`   = ${rol}: ya correcta`); continue; }
      console.log(`   ✎ ${rol}:\n       antes: "${antes}"\n       ahora: "${desc}"`);
      if (APPLY) {
        await client.query(
          `UPDATE "ROL_PERMISOS"
             SET "descripcion" = $1, "_updatedDate" = NOW(), "fechaActualizacion" = NOW()
           WHERE "rol" = $2`,
          [desc, rol]
        );
      }
    }

    // 2) Nuevo rol ACADEMICO_JEFE
    console.log(`\n2) Rol ${NUEVO_ROL}:`);
    const exists = await client.query(`SELECT 1 FROM "ROL_PERMISOS" WHERE "rol" = $1`, [NUEVO_ROL]);
    if (exists.rowCount > 0) {
      console.log(`   = ${NUEVO_ROL} ya existe, no se recrea.`);
    } else {
      const src = await client.query(`SELECT "permisos" FROM "ROL_PERMISOS" WHERE "rol" = $1`, [COPIAR_DE]);
      if (src.rowCount === 0) throw new Error(`No se encontró el rol origen ${COPIAR_DE}`);
      const permisos = src.rows[0].permisos; // jsonb -> array JS
      const newId = randomUUID();
      console.log(`   + Crear ${NUEVO_ROL} (_id=${newId}, activo=true)`);
      console.log(`     descripcion: "${NUEVA_DESC}"`);
      console.log(`     permisos copiados de ${COPIAR_DE}: ${permisos.length}`);
      if (APPLY) {
        await client.query(
          `INSERT INTO "ROL_PERMISOS"
             ("_id", "rol", "permisos", "descripcion", "activo",
              "fechaCreacion", "fechaActualizacion", "_createdDate", "_updatedDate", "origen")
           VALUES ($1, $2, $3::jsonb, $4, true, NOW(), NOW(), NOW(), NOW(), 'POSTGRES')`,
          [newId, NUEVO_ROL, JSON.stringify(permisos), NUEVA_DESC]
        );
      }
    }

    if (APPLY) { await client.query('COMMIT'); console.log('\n✅ COMMIT'); }
    else { await client.query('ROLLBACK'); console.log('\n(dry-run) ROLLBACK — nada se escribió'); }

    // Verificacion
    const ver = await client.query(`
      SELECT "rol", "descripcion", "activo",
             jsonb_array_length("permisos") AS n,
             "fechaActualizacion"::date AS fa
      FROM "ROL_PERMISOS"
      WHERE "rol" = ANY($1) OR "rol" = $2
      ORDER BY "rol"
    `, [Object.keys(DESCRIPCIONES), NUEVO_ROL]);
    console.log('\n── Estado actual de filas afectadas ──');
    for (const r of ver.rows) {
      console.log(`   ${String(r.rol).padEnd(24)} act=${r.activo} n=${String(r.n).padEnd(4)} fechaAct=${r.fa ? r.fa.toISOString().slice(0,10) : 'NULL'}  "${r.descripcion}"`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR (rollback):', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
