#!/usr/bin/env node
/**
 * backfill-drive-fileid.js — rellena PEOPLE.driveFileId con el fileId actual de
 * cada contrato que ya está en la carpeta CONTRATOS LGS (para que la descarga lo
 * lea directo por id, sin depender de la búsqueda por appProperties).
 *
 * Lista todos los archivos NO-papelera de la carpeta con appProperties.documento,
 * deduplica por documento (se queda el más reciente) y hace
 * UPDATE PEOPLE SET driveFileId=<fileId> WHERE _id=<documento>.
 *
 * Idempotente. Dry-run por defecto. La clave se pasa por --key (nunca en el repo).
 * USO: node scripts/backfill-drive-fileid.js --key <ruta.json> [--apply]
 * Requiere IP whitelisteada en el firewall (usa DATABASE_URL de .env.local).
 */
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const keyIdx = process.argv.indexOf('--key');
const KEY_PATH = keyIdx >= 0 ? process.argv[keyIdx + 1] : null;
const FOLDER = '1-DxP4mlk6aJQYY3vRTiPgPouOK9ydWhV';

function loadSA() {
  const raw = KEY_PATH ? fs.readFileSync(KEY_PATH, 'utf8') : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Falta la clave: --key <ruta.json> o GOOGLE_SERVICE_ACCOUNT_JSON');
  const sa = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
  return sa;
}
const b64 = (x) => (Buffer.isBuffer(x) ? x : Buffer.from(x)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const s = b64(crypto.createSign('RSA-SHA256').update(`${h}.${c}`).sign(sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${s}` }) });
  const d = await r.json();
  if (!d.access_token) throw new Error('token: ' + JSON.stringify(d));
  return d.access_token;
}

(async () => {
  const sa = loadSA();
  const t = await token(sa);
  console.log(`\n===== BACKFILL PEOPLE.driveFileId (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  // Listar la carpeta nueva (no-papelera) con documento + modifiedTime.
  const byDoc = new Map();
  let pageToken = null, total = 0;
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${FOLDER}' in parents and trashed=false`);
    u.searchParams.set('supportsAllDrives', 'true');
    u.searchParams.set('includeItemsFromAllDrives', 'true');
    u.searchParams.set('corpora', 'allDrives');
    u.searchParams.set('fields', 'nextPageToken, files(id,appProperties,modifiedTime)');
    u.searchParams.set('pageSize', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const d = await (await fetch(u, { headers: { Authorization: `Bearer ${t}` } })).json();
    for (const f of (d.files || [])) {
      total++;
      const doc = f.appProperties?.documento;
      if (!doc) continue;
      const prev = byDoc.get(doc);
      if (!prev || (f.modifiedTime || '') > (prev.mod || '')) byDoc.set(doc, { id: f.id, mod: f.modifiedTime });
    }
    pageToken = d.nextPageToken;
  } while (pageToken);
  console.log(`Archivos en la carpeta: ${total} · documentos únicos: ${byDoc.size}`);

  if (!APPLY) {
    console.log('\n[dry-run] ejemplos:');
    let i = 0;
    for (const [doc, v] of byDoc) { if (i++ >= 5) break; console.log(`  ${doc} → ${v.id}`); }
    console.log('\nUsa --apply para escribir PEOPLE.driveFileId');
    return;
  }

  const pg = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await pg.connect();
  // UPDATE masivo con unnest (1 sola query, mucho más rápido que N round-trips).
  const docs = [], fids = [];
  for (const [doc, v] of byDoc) { docs.push(doc); fids.push(v.id); }
  const r = await pg.query(
    `UPDATE "PEOPLE" p SET "driveFileId" = d.fid
       FROM (SELECT UNNEST($1::text[]) AS doc, UNNEST($2::text[]) AS fid) d
      WHERE p."_id" = d.doc`,
    [docs, fids],
  );
  await pg.end();
  console.log(`🟢 Backfill: ${r.rowCount} PEOPLE actualizados (de ${byDoc.size} documentos en Drive)`);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
