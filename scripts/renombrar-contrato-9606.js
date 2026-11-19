/* Borra el contrato 01-9606-25 (duplicado sin firmar) y renombra 04-9606-25 -> 01-9606-25. Uso: node scripts/renombrar-contrato-9606.js [--apply] */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');
const OLD = '01-9606-25', NEW = '04-9606-25', apply = process.argv.includes('--apply');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    const people = (await c.query(`SELECT * FROM "PEOPLE" WHERE "contrato"=$1`,[OLD])).rows;
    const ids = people.map(p=>p._id);
    const pagos = (await c.query(`SELECT * FROM "PAGOS_TITULARES" WHERE "idPeople"=ANY($1::text[])`,[ids])).rows;
    const fin = (await c.query(`SELECT * FROM "FINANCIEROS" WHERE "contrato"=$1`,[OLD])).rows;
    if (!people.length) throw new Error('El 01 ya no existe');
    if (people.some(p=>p.hashConsentimiento) || people.some(p=>p.aprobacion && p.aprobacion!=='Pendiente')) throw new Error('El 01 tiene firma/estado: abortado');
    const cl = (await c.query(`SELECT count(*)::int n FROM "ACADEMICA_BOOKINGS" b JOIN "ACADEMICA" a ON a."_id"=COALESCE(b."studentId",b."idEstudiante") WHERE a."contrato"=$1`,[OLD])).rows[0].n;
    if (cl) throw new Error('clases en el 01');
    fs.writeFileSync(`docs/backup-contrato-9606-${Date.now()}.json`, JSON.stringify({ people, pagos, fin }, null, 1));
    const d = {};
    d.pagos = (await c.query(`DELETE FROM "PAGOS_TITULARES" WHERE "idPeople"=ANY($1::text[])`,[ids])).rowCount;
    d.fin = (await c.query(`DELETE FROM "FINANCIEROS" WHERE "contrato"=$1`,[OLD])).rowCount;
    d.people = (await c.query(`DELETE FROM "PEOPLE" WHERE "_id"=ANY($1::text[])`,[ids])).rowCount;
    const r = {};
    r.people = (await c.query(`UPDATE "PEOPLE" SET "contrato"=$1 WHERE "contrato"=$2`,[OLD,NEW])).rowCount;
    r.numeroContrato = (await c.query(`UPDATE "PEOPLE" SET "numeroContrato"=$1 WHERE "numeroContrato"=$2`,[OLD,NEW])).rowCount;
    r.fin = (await c.query(`UPDATE "FINANCIEROS" SET "contrato"=$1 WHERE "contrato"=$2`,[OLD,NEW])).rowCount;
    r.acad = (await c.query(`UPDATE "ACADEMICA" SET "contrato"=$1 WHERE "contrato"=$2`,[OLD,NEW])).rowCount;
    r.usr = (await c.query(`UPDATE "USUARIOS_ROLES" SET "contrato"=$1 WHERE "contrato"=$2`,[OLD,NEW])).rowCount;
    console.log('borrados', d, 'renombrados', r);
    const left = (await c.query(`SELECT count(*)::int n FROM "PEOPLE" WHERE "contrato"=$1`,[NEW])).rows[0].n;
    if (left) throw new Error('quedan registros con 04');
    if (!apply) { await c.query('ROLLBACK'); console.log('(dry-run, revertido)'); }
    else { await c.query('COMMIT'); console.log('APLICADO'); }
  } catch (e) { await c.query('ROLLBACK').catch(()=>{}); console.error('ERROR', e.message); process.exit(1); }
  finally { await c.end(); }
})();
