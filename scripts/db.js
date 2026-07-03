#!/usr/bin/env node
/**
 * db.js — Cliente SQL para leer/escribir en la BD (PostgreSQL gestionado en DO).
 *
 * Se conecta con `pg` + SSL usando DATABASE_URL de .env.local y (por defecto)
 * gestiona el firewall solo: whitelistea tu IP pública al iniciar y la remueve
 * al salir (higiene de seguridad). Sirve para SELECT y para escrituras
 * (INSERT/UPDATE/DELETE/ALTER…).
 *
 * USO:
 *   node scripts/db.js "SELECT * FROM \"PEOPLE\" LIMIT 5"     # una consulta
 *   node scripts/db.js -f consulta.sql                          # desde archivo
 *   node scripts/db.js                                          # modo interactivo (REPL)
 *
 * FLAGS:
 *   --no-fw     No tocar el firewall (útil si tu IP ya está whitelisteada)
 *   --json      Imprime filas como JSON en vez de tabla
 *
 * REPL: escribe SQL terminando en `;` para ejecutar. `.tables` lista tablas,
 *       `.exit` (o Ctrl+C) sale.
 *
 * ⚠️  Escribe en PRODUCCIÓN. Las escrituras se ejecutan tal cual (sin dry-run).
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const args = process.argv.slice(2);
const NO_FW = args.includes('--no-fw');
const AS_JSON = args.includes('--json');
const fileIdx = args.indexOf('-f');
const sqlFile = fileIdx >= 0 ? args[fileIdx + 1] : null;
const inlineSql = args.filter((a, i) => !a.startsWith('--') && i !== fileIdx && !(fileIdx >= 0 && i === fileIdx + 1)).join(' ').trim();

function getPublicIP() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d.trim())); }).on('error', reject);
  });
}
const sh = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } };

async function fwAdd(ip) {
  process.stdout.write(`🔓 Whitelisteando ${ip} en el firewall...`);
  sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`);
  await new Promise(r => setTimeout(r, 9000)); // propagación
  console.log(' ok');
}
function fwRemove(ip) {
  const list = sh(`doctl databases firewalls list ${CLUSTER}`);
  const uuid = list.split('\n').find(l => l.includes(ip))?.trim().split(/\s+/)[0];
  if (uuid) { sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${uuid}`); console.log(`🔒 IP ${ip} removida del firewall`); }
}

function printResult(res) {
  if (!res) return;
  if (res.command && res.rowCount != null && (!res.rows || res.rows.length === 0)) {
    console.log(`✔ ${res.command} — ${res.rowCount} fila(s) afectada(s)`); return;
  }
  const rows = res.rows || [];
  if (rows.length === 0) { console.log('(0 filas)'); return; }
  if (AS_JSON) { console.log(JSON.stringify(rows, null, 2)); return; }
  const cols = Object.keys(rows[0]);
  const cell = v => v === null ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => cell(r[c]).length)));
  const line = (vals) => vals.map((v, i) => cell(v).slice(0, 60).padEnd(Math.min(widths[i], 60))).join(' │ ');
  console.log(line(cols));
  console.log(widths.map(w => '─'.repeat(Math.min(w, 60))).join('─┼─'));
  rows.forEach(r => console.log(line(cols.map(c => r[c]))));
  console.log(`\n(${rows.length} fila(s))`);
}

(async () => {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL en .env.local'); process.exit(1); }
  const ip = NO_FW ? null : await getPublicIP();
  if (ip) await fwAdd(ip);

  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  });

  const cleanup = () => { if (ip) fwRemove(ip); };
  process.on('SIGINT', () => { console.log(); cleanup(); client.end().finally(() => process.exit(0)); });

  try {
    await client.connect();
    const runQuery = async (sql) => {
      const t = Date.now();
      const res = await client.query(sql);
      if (Array.isArray(res)) res.forEach(printResult); else printResult(res);
      console.log(`⏱  ${Date.now() - t} ms`);
    };

    const oneShot = sqlFile ? fs.readFileSync(sqlFile, 'utf8') : inlineSql;
    if (oneShot) {
      await runQuery(oneShot).catch(e => console.error('❌', e.message));
    } else {
      // REPL
      console.log('BD conectada. Escribe SQL terminando en ";" (.tables, .exit)\n');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'sql> ' });
      let buf = '';
      rl.prompt();
      rl.on('line', async (l) => {
        const t = l.trim();
        if (t === '.exit' || t === 'exit' || t === 'quit') { rl.close(); return; }
        if (t === '.tables') {
          await runQuery(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`).catch(e => console.error('❌', e.message));
          rl.prompt(); return;
        }
        buf += l + '\n';
        if (t.endsWith(';')) {
          await runQuery(buf.trim().replace(/;+$/, '')).catch(e => console.error('❌', e.message));
          buf = '';
        }
        rl.prompt();
      });
      await new Promise(res => rl.on('close', res));
    }
  } finally {
    await client.end().catch(() => {});
    cleanup();
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
