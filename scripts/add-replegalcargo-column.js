/**
 * add-replegalcargo-column.js
 *
 * Utilidad: agrega `PEOPLE.replegalcargo` (VARCHAR 120, nullable) — cargo del
 * representante de la empresa (Gerente General, Apoderado, etc.).
 *
 * ⚠️ NO confundir con `PEOPLE.cargo`, que ya existe y es el cargo laboral del
 * titular PERSONA NATURAL (bloque "Empresa: / Cargo:" de su contrato). Son dos
 * campos distintos: este solo aplica a `tipoPersona='Empresa'`.
 *
 * En el contrato va en el bloque REPRESENTANTE DE LA EMPRESA, bajo el Nombre.
 *
 * Uso:
 *   node scripts/add-replegalcargo-column.js            (dry-run)
 *   node scripts/add-replegalcargo-column.js --apply    (escribe)
 *
 * Idempotente: `ADD COLUMN IF NOT EXISTS`. No toca datos existentes.
 * Gestiona el firewall solo (whitelistea la IP y la remueve al terminar).
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');

const APPLY = process.argv.includes('--apply');
const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const COLUMNA = 'replegalcargo';

const getIp = () =>
  new Promise((res, rej) => {
    https.get('https://api.ipify.org', (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res(d.trim()));
    }).on('error', rej);
  });

const sh = (cmd) => { try { return execSync(cmd, { stdio: 'pipe' }).toString(); } catch { return ''; } };

(async () => {
  const ip = await getIp();
  sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`);
  console.log(`IP ${ip} whitelisteada`);
  await new Promise((r) => setTimeout(r, 9000));

  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const { rows: existe } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'PEOPLE' AND column_name = $1`,
      [COLUMNA],
    );
    if (existe.length) {
      console.log(`La columna PEOPLE.${COLUMNA} ya existe — nada que hacer.`);
      return;
    }

    const { rows: [{ total }] } = await client.query(
      `SELECT COUNT(*)::int AS total FROM "PEOPLE" WHERE "tipoPersona" = 'Empresa'`,
    );
    console.log(`Titulares tipo Empresa que podrán usarla: ${total}`);
    console.log('');
    console.log(`DDL: ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "${COLUMNA}" VARCHAR(120)`);

    if (!APPLY) {
      console.log('');
      console.log('DRY-RUN: nada se escribió. Repetir con --apply para aplicar.');
      return;
    }

    await client.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "${COLUMNA}" VARCHAR(120)`);
    const { rows: check } = await client.query(
      `SELECT column_name, data_type, character_maximum_length
         FROM information_schema.columns
        WHERE table_name = 'PEOPLE' AND column_name = $1`,
      [COLUMNA],
    );
    console.log('');
    console.log('APLICADO:', JSON.stringify(check[0]));
  } finally {
    await client.end().catch(() => {});
    const list = sh(`doctl databases firewalls list ${CLUSTER}`);
    list.split('\n').filter((l) => l.includes(ip)).forEach((l) => {
      const uuid = l.trim().split(/\s+/)[0];
      if (uuid) sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${uuid}`);
    });
    console.log(`IP ${ip} removida del firewall`);
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
