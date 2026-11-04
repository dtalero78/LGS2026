/**
 * consolidar-coordinadores-advisor.js — un solo login (el de COORDINADOR_ACADEMICO)
 * para los coordinadores que también dictan clases: Andrés Chousal, Dario Rubio y
 * Hernán Tenorio. Acordado con el usuario el 2026-11-03.
 *
 * La historia de clases (CALENDARIO, ACADEMICA_BOOKINGS, ADVISOR_EVENT_LOG, …) está
 * ligada al ADVISORS._id, nunca al correo: se cambia el login DUEÑO de la ficha
 * (email + usuarioRolId) sin tocar las clases.
 *
 *  - Andrés: su ficha con historia pasa a su login coordinador (andreschousal.acade@).
 *  - Dario:  ya usa la ficha "Coordinador"; la ficha "Advisor" vacía se desactiva.
 *  - Hernán: su ficha activa pasa al login coordinador; lo de la ficha coordinador
 *            (inactiva) se mueve a la principal.
 *  - Los logins ADVISOR (gmail) de los tres se DESACTIVAN (no se borran).
 *  - Las fichas que quedan inactivas cambian su correo a "<email>.inactivo" para que
 *    la búsqueda por correo encuentre una sola ficha.
 *
 * Dry-run por defecto; --apply en transacción con respaldo en docs/.
 * Uso: node scripts/consolidar-coordinadores-advisor.js [--apply]
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

const PLAN = [
  {
    persona: 'Andrés Chousal',
    principal: '70976489-5d31-4b4d-9b26-5a4d09f59e26',
    loginCoord: 'andreschousal.acade@letsgospeak.cl',
    fusionar: [],
    loginsDesactivar: ['andres.chousal@gmail.com'],
  },
  {
    persona: 'Dario Rubio',
    principal: '098ca45d-8f5c-445f-b0c9-7abe43b35755',
    loginCoord: 'dj.rubio@letsgospeak.com',
    nombre: { primerNombre: 'Dario Junior', primerApellido: 'Rubio Ramos', nombreCompleto: 'Dario Junior Rubio Ramos' },
    fusionar: ['dblgs_1793728090754_fgi2ho'],
    loginsDesactivar: ['dariorubioramos@gmail.com'],
  },
  {
    persona: 'Hernán Tenorio',
    principal: '17a8041f-7974-4f37-a621-710c6f8dbcda',
    loginCoord: 'ha.tenorio@letsgospeak.com.co',
    fusionar: ['8452034d-d2b9-4869-b949-0745d0122e2b'],
    loginsDesactivar: ['hernant287@gmail.com'],
  },
];

// Tablas que referencian ADVISORS._id (todas se mueven de la ficha fusionada a la principal)
const REFS = [
  ['CALENDARIO', 'advisor'],
  ['ACADEMICA_BOOKINGS', 'advisor'],
  ['ACADEMICA_BOOKING_EVALUATIONS', 'advisorId'],
  ['ADMIN_EVENTS', 'advisorId'],
  ['ADVISOR_EVENT_LOG', 'advisorId'],
  ['CANCELACIONES_SIN_REEMPLAZO', 'advisorId'],
  ['LIQ_ADVISOR', 'advisorId'],
];

(async () => {
  console.log(APPLY ? '== APPLY ==' : '== DRY-RUN (sin --apply no escribe) ==');
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const backup = { advisors: [], usuarios: [], refs: [] };
  try {
    // Verificación previa y respaldo
    for (const p of PLAN) {
      const ids = [p.principal, ...p.fusionar];
      const adv = (await c.query(`SELECT * FROM "ADVISORS" WHERE "_id" = ANY($1::text[])`, [ids])).rows;
      if (adv.length !== ids.length) throw new Error(`${p.persona}: faltan fichas ADVISORS`);
      const coord = (await c.query(`SELECT * FROM "USUARIOS_ROLES" WHERE LOWER("email") = LOWER($1)`, [p.loginCoord])).rows;
      if (coord.length !== 1 || coord[0].rol !== 'COORDINADOR_ACADEMICO') throw new Error(`${p.persona}: login coordinador no encontrado o rol inesperado`);
      const logins = (await c.query(`SELECT * FROM "USUARIOS_ROLES" WHERE LOWER("email") = ANY($1::text[])`, [p.loginsDesactivar.map((e) => e.toLowerCase())])).rows;
      for (const l of logins) if (l.rol !== 'ADVISOR') throw new Error(`${p.persona}: ${l.email} no es rol ADVISOR (${l.rol})`);
      backup.advisors.push(...adv);
      backup.usuarios.push(...coord, ...logins);
      p._coordId = coord[0]._id;

      console.log(`\n${p.persona}`);
      const pr = adv.find((a) => a._id === p.principal);
      console.log(`  ficha principal ${pr._id} "${pr.nombreCompleto}": email ${pr.email} → ${p.loginCoord}; usuarioRolId ${pr.usuarioRolId} → ${p._coordId}`);
      if (p.nombre) console.log(`  nombre → ${p.nombre.nombreCompleto}`);
      for (const f of p.fusionar) {
        for (const [t, col] of REFS) {
          const n = (await c.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE "${col}" = $1`, [f])).rows[0].n;
          if (n) { console.log(`  mover ${n} filas de ${t}.${col}: ${f} → principal`); backup.refs.push({ tabla: t, col, desde: f, hacia: p.principal, n }); }
        }
        console.log(`  ficha ${f} → inactiva (email + ".inactivo")`);
      }
      for (const l of logins) console.log(`  login ADVISOR ${l.email} (activo=${l.activo}) → activo=false`);
    }

    // Permisos del rol coordinador para ver su panel y su Ctrl Horas
    const perm = (await c.query(`SELECT "permisos" FROM "ROL_PERMISOS" WHERE "rol" = 'COORDINADOR_ACADEMICO'`)).rows[0];
    const lista = Array.isArray(perm?.permisos) ? perm.permisos : JSON.parse(perm?.permisos || '[]');
    for (const p of ['ACADEMICO.ADVISOR.VER_ENLACE', 'ACADEMICO.CONTROL_HORAS.VER_TODOS']) {
      console.log(`\nCOORDINADOR_ACADEMICO tiene ${p}: ${lista.includes(p) ? 'sí' : 'NO'}`);
    }

    if (!APPLY) return;

    const file = `docs/backup-consolidar-coordinadores-${Date.now()}.json`;
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nRespaldo: ${file}`);

    await c.query('BEGIN');
    for (const p of PLAN) {
      // 1) Fichas fusionadas: mover referencias y desactivar (correo marcado)
      for (const f of p.fusionar) {
        for (const [t, col] of REFS) await c.query(`UPDATE "${t}" SET "${col}" = $1 WHERE "${col}" = $2`, [p.principal, f]);
        await c.query(
          `UPDATE "ADVISORS" SET "activo" = false, "email" = "email" || '.inactivo', "usuarioRolId" = NULL, "_updatedDate" = NOW()
            WHERE "_id" = $1 AND "email" NOT LIKE '%.inactivo'`, [f]);
      }
      // 2) Ficha principal → login coordinador
      await c.query(
        `UPDATE "ADVISORS" SET "email" = $2, "usuarioRolId" = $3, "activo" = true, "_updatedDate" = NOW() WHERE "_id" = $1`,
        [p.principal, p.loginCoord, p._coordId]);
      if (p.nombre) {
        await c.query(`UPDATE "ADVISORS" SET "primerNombre" = $2, "primerApellido" = $3, "nombreCompleto" = $4 WHERE "_id" = $1`,
          [p.principal, p.nombre.primerNombre, p.nombre.primerApellido, p.nombre.nombreCompleto]);
      }
      // 3) Logins ADVISOR → inactivos (nunca se borran)
      await c.query(`UPDATE "USUARIOS_ROLES" SET "activo" = false WHERE LOWER("email") = ANY($1::text[]) AND "rol" = 'ADVISOR'`,
        [p.loginsDesactivar.map((e) => e.toLowerCase())]);
      await c.query(
        `INSERT INTO "LIQ_ADVISOR_LOG" ("_id","advisorId","accion","detalle","usuarioEmail") VALUES ($1,$2,'CONSOLIDAR_COORDINADOR',$3,'script')`,
        [`lql_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, p.principal,
         JSON.stringify({ persona: p.persona, loginCoord: p.loginCoord, fusionadas: p.fusionar, loginsDesactivados: p.loginsDesactivar, backup: file })]);
    }
    await c.query('COMMIT');
    console.log('✔ Consolidación aplicada.');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
