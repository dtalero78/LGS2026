#!/usr/bin/env node
/**
 * create-zoom-accesos-table.js — bitácora de accesos a Zoom del panel del alumno.
 *
 * Una fila POR CLIC (no un estado): si el alumno vuelve a entrar porque se le cayó
 * la conexión, queda otra fila. Sirve para (a) la RECONEXIÓN personal — quien
 * generó el acceso dentro de la ventana conserva el ícono hasta 10 min antes del
 * fin de la clase — y (b) contrastar contra el reporte de asistentes de Zoom.
 *
 * Tabla aparte (NO columna de ACADEMICA_BOOKINGS): un clic en el ícono no debe
 * interferir con el ciclo de vida del booking. Llave estable `(academicaId,
 * fechaEvento)` (el instante de la clase); `eventoId` se guarda para el lookup.
 *
 * Idempotente (CREATE TABLE IF NOT EXISTS). Dry-run por defecto. Gestiona el firewall solo.
 * USO: node scripts/create-zoom-accesos-table.js [--apply] [--no-fw]
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const CLUSTER = '08d65733-6811-420c-a0a1-a71d6b3b9c6d';
const APPLY = process.argv.includes('--apply');
const NO_FW = process.argv.includes('--no-fw');

const DDL = `
CREATE TABLE IF NOT EXISTS "ZOOM_ACCESOS" (
  "_id"                TEXT PRIMARY KEY,
  "academicaId"        TEXT NOT NULL,
  "numeroId"           TEXT,
  "nombre"             TEXT,
  "bookingId"          TEXT,
  "eventoId"           TEXT,
  "fechaEvento"        TIMESTAMPTZ NOT NULL,
  "nivel"              TEXT,
  "step"               TEXT,
  "tipo"               TEXT,
  "minutosDesdeInicio" INTEGER,
  "ip"                 TEXT,
  "userAgent"          TEXT,
  "_createdDate"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_zoom_accesos_alumno_fecha" ON "ZOOM_ACCESOS" ("academicaId", "fechaEvento");
CREATE INDEX IF NOT EXISTS "idx_zoom_accesos_evento" ON "ZOOM_ACCESOS" ("eventoId");
CREATE INDEX IF NOT EXISTS "idx_zoom_accesos_fecha" ON "ZOOM_ACCESOS" ("_createdDate" DESC);
`;

function getPublicIP() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d.trim())); }).on('error', reject);
  });
}
const sh = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } };
async function fwAdd(ip) { process.stdout.write(`🔓 Whitelisteando ${ip}...`); sh(`doctl databases firewalls append ${CLUSTER} --rule ip_addr:${ip}`); await new Promise(r => setTimeout(r, 9000)); console.log(' ok'); }
function fwRemove(ip) { const l = sh(`doctl databases firewalls list ${CLUSTER}`); const u = l.split('\n').find(x => x.includes(ip))?.trim().split(/\s+/)[0]; if (u) { sh(`doctl databases firewalls remove ${CLUSTER} --uuid ${u}`); console.log(`🔒 IP ${ip} removida`); } }

(async () => {
  let ip = null;
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    if (!NO_FW) { ip = await getPublicIP(); await fwAdd(ip); }
    await c.connect();
    console.log(`\n===== create-zoom-accesos-table (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

    const existe = (await c.query(`SELECT to_regclass('"ZOOM_ACCESOS"') IS NOT NULL AS e`)).rows[0].e;
    if (existe) {
      const n = (await c.query(`SELECT COUNT(*)::int AS n FROM "ZOOM_ACCESOS"`)).rows[0].n;
      console.log(`✓ La tabla ya existe (${n} fila(s)) — nada que hacer.`);
      return;
    }
    if (!APPLY) { console.log('[dry-run] usa --apply para crear la tabla ZOOM_ACCESOS.'); console.log(DDL); return; }

    await c.query(DDL);
    const cols = (await c.query(`SELECT COUNT(*)::int AS c FROM information_schema.columns WHERE table_name='ZOOM_ACCESOS'`)).rows[0].c;
    console.log(`🟢 ZOOM_ACCESOS creada (${cols} columnas).`);
  } catch (e) {
    console.error('ERROR:', e.message); process.exitCode = 1;
  } finally {
    try { await c.end(); } catch {}
    if (ip) fwRemove(ip);
  }
})();
