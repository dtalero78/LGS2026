/**
 * add-pago-doble-column.js
 *
 * Utilidad: agrega `PAGOS_TITULARES.pagoDoble` (BOOLEAN default false).
 *
 * Marca las filas nacidas de un **Pago doble**: el operador captura un solo
 * valor y el sistema lo parte en DOS registros con la misma fecha de pago —
 * uno para la cuota #N y otro para la #N+1 (adelanto de la siguiente cuota).
 * Ambos registros quedan con `pagoDoble=true`, que es lo que la tabla de pagos
 * usa para mostrarlos con la etiqueta **"Adelanto cuota"**.
 *
 * El desdoble lo hace el SERVIDOR (`pagosTitularesService.createPagoDoble`),
 * que además calcula el saldo en cascada: la segunda fila arranca del saldo que
 * dejó la primera.
 *
 * Uso:
 *   node scripts/add-pago-doble-column.js            (dry-run)
 *   node scripts/add-pago-doble-column.js --apply    (escribe)
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
const COLUMNA = 'pagoDoble';
const DDL = 'BOOLEAN DEFAULT false';

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
        WHERE table_name = 'PAGOS_TITULARES' AND column_name = $1`,
      [COLUMNA],
    );
    if (existe.length) {
      console.log(`La columna PAGOS_TITULARES.${COLUMNA} ya existe — nada que hacer.`);
      return;
    }

    const { rows: [{ total }] } = await client.query(
      `SELECT COUNT(*)::int AS total FROM "PAGOS_TITULARES"`,
    );
    console.log(`Filas en PAGOS_TITULARES: ${total}`);
    console.log('');
    console.log(`DDL: ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "${COLUMNA}" ${DDL}`);

    if (!APPLY) {
      console.log('');
      console.log('DRY-RUN: nada se escribió. Repetir con --apply para aplicar.');
      return;
    }

    await client.query(`ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "${COLUMNA}" ${DDL}`);
    const { rows: check } = await client.query(
      `SELECT column_name, data_type, column_default
         FROM information_schema.columns
        WHERE table_name = 'PAGOS_TITULARES' AND column_name = $1`,
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
