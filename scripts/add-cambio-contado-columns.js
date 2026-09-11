/**
 * add-cambio-contado-columns.js
 *
 * Utilidad: agrega a `PAGOS_TITULARES` las dos columnas del "Cambio Contado":
 *
 *   - `cambioContado` BOOLEAN DEFAULT false  → la casilla del wizard de pago.
 *   - `realizadopor`  VARCHAR(20)            → quién gestionó ese cambio:
 *        'Comercial'  si el pago ocurre dentro de los 30 días de aprobado el contrato
 *        'Recaudos'   si ocurre después
 *
 * `realizadopor` SOLO se llena cuando el pago viene con `cambioContado=true`;
 * en el resto queda NULL. Lo calcula el SERVIDOR (pagos-titulares.service) con
 * la regla de src/lib/cambio-contado.ts — el cliente nunca lo envía.
 *
 * La fecha base es la aprobación del contrato (`PEOPLE.fechaIngreso`) con
 * respaldo en `inicioContrato` → `fechaContrato` → `_createdDate`: solo ~60% de
 * los titulares aprobados tienen `fechaIngreso` (se empezó a sellar en mayo 2026),
 * mientras que `fechaContrato` está en el 100%.
 *
 * Uso:
 *   node scripts/add-cambio-contado-columns.js            (dry-run)
 *   node scripts/add-cambio-contado-columns.js --apply    (escribe)
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

const COLUMNAS = [
  { nombre: 'cambioContado', ddl: 'BOOLEAN DEFAULT false' },
  { nombre: 'realizadopor',  ddl: 'VARCHAR(20)' },
];

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

    const { rows: existentes } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'PAGOS_TITULARES' AND column_name = ANY($1)`,
      [COLUMNAS.map((c) => c.nombre)],
    );
    const yaEstan = new Set(existentes.map((r) => r.column_name));
    const faltan = COLUMNAS.filter((c) => !yaEstan.has(c.nombre));

    const { rows: [{ total }] } = await client.query(
      `SELECT COUNT(*)::int AS total FROM "PAGOS_TITULARES"`,
    );
    console.log(`Filas en PAGOS_TITULARES: ${total}`);
    yaEstan.forEach((n) => console.log(`  ya existe: ${n} — se omite`));

    if (!faltan.length) {
      console.log('Ambas columnas existen — nada que hacer.');
      return;
    }

    console.log('');
    faltan.forEach((c) =>
      console.log(`DDL: ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "${c.nombre}" ${c.ddl}`),
    );

    if (!APPLY) {
      console.log('');
      console.log('DRY-RUN: nada se escribió. Repetir con --apply para aplicar.');
      return;
    }

    for (const c of faltan) {
      await client.query(
        `ALTER TABLE "PAGOS_TITULARES" ADD COLUMN IF NOT EXISTS "${c.nombre}" ${c.ddl}`,
      );
    }

    const { rows: check } = await client.query(
      `SELECT column_name, data_type, character_maximum_length, column_default
         FROM information_schema.columns
        WHERE table_name = 'PAGOS_TITULARES' AND column_name = ANY($1)
        ORDER BY column_name`,
      [COLUMNAS.map((c) => c.nombre)],
    );
    console.log('');
    console.log('APLICADO:');
    check.forEach((r) => console.log('  ' + JSON.stringify(r)));
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
