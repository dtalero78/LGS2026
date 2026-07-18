#!/usr/bin/env node
/**
 * migrate-contratos-bsl-to-drive.js — migra los PDF de contrato de la carpeta
 * VIEJA de bsl (Google Drive personal, archivos nombrados por titularId) a la
 * Unidad compartida CONTRATOS LGS, usando la cuenta de servicio.
 *
 * Por cada titular único (dedup por nombre, se queda el más reciente):
 *   - descarga los bytes del PDF viejo (la cuenta de servicio ya tiene acceso),
 *   - resuelve nombre + numeroId en PEOPLE para renombrarlo,
 *   - lo sube a la Unidad compartida como "lgs <nombre> <apellido> <numeroId>.pdf"
 *     con appProperties {documento: titularId, empresa:'LGS'} (idempotente:
 *     sobrescribe por documento, no duplica).
 *
 * La carpeta VIEJA NO se toca (queda de respaldo).
 *
 * USO:
 *   node scripts/migrate-contratos-bsl-to-drive.js --key <ruta.json> [--apply] [--limit N]
 *   (la clave también puede venir de GOOGLE_SERVICE_ACCOUNT_JSON)
 *   Requiere IP whitelisteada en el firewall (usa DATABASE_URL de .env.local).
 */
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const keyArgIdx = process.argv.indexOf('--key');
const KEY_PATH = keyArgIdx >= 0 ? process.argv[keyArgIdx + 1] : null;
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : null;

const OLD_FOLDER = '1lP8EMIgqZHEVs0JRE6cgXWihx6M7Jxjf';       // bsl (personal)
const NEW_FOLDER = '1-DxP4mlk6aJQYY3vRTiPgPouOK9ydWhV';       // Unidad compartida CONTRATOS LGS
const CONCURRENCY = 6;

function loadSA() {
  let raw = KEY_PATH ? fs.readFileSync(KEY_PATH, 'utf8') : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Falta la clave: pasa --key <ruta.json> o define GOOGLE_SERVICE_ACCOUNT_JSON');
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(text);
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
  return sa;
}

const b64url = (x) => (Buffer.isBuffer(x) ? x : Buffer.from(x)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let _tok = null;
async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_tok && _tok.exp - 60 > now) return _tok.value;
  const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const s = b64url(crypto.createSign('RSA-SHA256').update(`${h}.${c}`).sign(sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${s}` }) });
  const d = await r.json();
  if (!d.access_token) throw new Error('token: ' + JSON.stringify(d));
  _tok = { value: d.access_token, exp: now + (d.expires_in || 3600) };
  return _tok.value;
}

async function listFolder(sa, folderId) {
  const out = [];
  let pageToken = null;
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
    u.searchParams.set('supportsAllDrives', 'true');
    u.searchParams.set('includeItemsFromAllDrives', 'true');
    u.searchParams.set('corpora', 'allDrives');
    u.searchParams.set('fields', 'nextPageToken, files(id,name,modifiedTime)');
    u.searchParams.set('pageSize', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${await token(sa)}` } });
    const d = await r.json();
    if (!r.ok) throw new Error('list: ' + JSON.stringify(d));
    out.push(...(d.files || []));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}

async function downloadBytes(sa, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await token(sa)}` } });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function findInNewByDocumento(sa, documento) {
  const u = new URL('https://www.googleapis.com/drive/v3/files');
  u.searchParams.set('q', `appProperties has { key='documento' and value='${documento.replace(/'/g, "\\'")}' } and trashed=false`);
  u.searchParams.set('supportsAllDrives', 'true');
  u.searchParams.set('includeItemsFromAllDrives', 'true');
  u.searchParams.set('corpora', 'allDrives');
  u.searchParams.set('fields', 'files(id)');
  const r = await fetch(u, { headers: { Authorization: `Bearer ${await token(sa)}` } });
  const d = await r.json();
  if (!r.ok) throw new Error('find: ' + JSON.stringify(d));
  return d.files?.[0]?.id ?? null;
}

async function uploadToNew(sa, bytes, name, documento) {
  const existing = await findInNewByDocumento(sa, documento);
  const boundary = 'lgs' + crypto.randomBytes(8).toString('hex');
  const meta = existing ? { name } : { name, parents: [NEW_FOLDER], appProperties: { documento, empresa: 'LGS' } };
  const pre = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, 'utf8');
  const post = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([pre, bytes, post]);
  const base = 'https://www.googleapis.com/upload/drive/v3/files';
  const url = existing
    ? `${base}/${existing}?uploadType=multipart&supportsAllDrives=true&fields=id`
    : `${base}?uploadType=multipart&supportsAllDrives=true&fields=id`;
  const r = await fetch(url, { method: existing ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${await token(sa)}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  const d = await r.json();
  if (!r.ok || !d.id) throw new Error('upload: ' + JSON.stringify(d));
  return { id: d.id, overwrote: !!existing };
}

const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const sa = loadSA();
  console.log(`\n===== MIGRACIÓN bsl → Unidad compartida (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  // 1. Listar carpeta vieja y deduplicar por titularId (nombre sin .pdf), quedando el más reciente.
  const files = await listFolder(sa, OLD_FOLDER);
  const byDoc = new Map();
  for (const f of files) {
    const doc = f.name.replace(/\.pdf$/i, '');
    const prev = byDoc.get(doc);
    if (!prev || (f.modifiedTime || '') > (prev.modifiedTime || '')) byDoc.set(doc, { id: f.id, modifiedTime: f.modifiedTime });
  }
  let docs = [...byDoc.keys()];
  console.log(`Archivos: ${files.length} · titulares únicos (dedup): ${docs.length}`);
  if (LIMIT) { docs = docs.slice(0, LIMIT); console.log(`(limitado a ${LIMIT})`); }

  // 2. Resolver nombre + numeroId en PEOPLE (una sola query).
  const pg = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await pg.connect();
  const rows = (await pg.query(
    `SELECT "_id", "primerNombre", "primerApellido", "numeroId" FROM "PEOPLE" WHERE "_id" = ANY($1)`,
    [docs],
  )).rows;
  await pg.end();
  const nameMap = new Map(rows.map(r => [r._id, r]));
  const resueltos = docs.filter(d => nameMap.has(d)).length;
  const mosCount = docs.filter(d => /^MOS_/i.test(d)).length;
  console.log(`Nombres resueltos en PEOPLE (LGS): ${resueltos} · sin resolver: ${docs.length - resueltos} (de ellos MOSAICO MOS_: ${mosCount})`);

  // Por defecto solo se migran los contratos de titulares LGS resueltos en PEOPLE.
  // --include-unresolved agrega el resto PERO nunca los MOSAICO (MOS_).
  const INCLUDE_UNRESOLVED = process.argv.includes('--include-unresolved');
  const antes = docs.length;
  docs = INCLUDE_UNRESOLVED
    ? docs.filter(d => !/^MOS_/i.test(d))
    : docs.filter(d => nameMap.has(d));
  console.log(`A migrar: ${docs.length} (excluidos: ${antes - docs.length}${INCLUDE_UNRESOLVED ? ' — solo MOSAICO' : ' — sin resolver + MOSAICO'})`);

  // --skip-existing: salta los que YA están en la carpeta nueva (para resumir sin
  // re-procesar los ya migrados). Lista la carpeta nueva una vez por appProperties.
  if (process.argv.includes('--skip-existing')) {
    const done = new Set();
    let pt = null;
    do {
      const u = new URL('https://www.googleapis.com/drive/v3/files');
      u.searchParams.set('q', `'${NEW_FOLDER}' in parents and trashed=false`);
      u.searchParams.set('supportsAllDrives', 'true'); u.searchParams.set('includeItemsFromAllDrives', 'true');
      u.searchParams.set('corpora', 'allDrives');
      u.searchParams.set('fields', 'nextPageToken, files(appProperties)');
      u.searchParams.set('pageSize', '1000');
      if (pt) u.searchParams.set('pageToken', pt);
      const d = await (await fetch(u, { headers: { Authorization: `Bearer ${await token(sa)}` } })).json();
      for (const f of (d.files || [])) { const doc = f.appProperties?.documento; if (doc) done.add(doc); }
      pt = d.nextPageToken;
    } while (pt);
    const before = docs.length;
    docs = docs.filter(d => !done.has(d));
    console.log(`skip-existing: ya migrados ${done.size} · pendientes ${docs.length} (de ${before})`);
  }

  if (!APPLY) {
    console.log(`\n[dry-run] Se migrarían ${docs.length} contratos. Usa --apply para ejecutar.`);
    // muestra 5 ejemplos de nombre destino
    for (const d of docs.slice(0, 5)) {
      const p = nameMap.get(d);
      const name = p ? `lgs ${sanitize(p.primerNombre)} ${sanitize(p.primerApellido)} ${sanitize(p.numeroId)}.pdf` : `${d}.pdf`;
      console.log(`   ${d}  →  ${name}`);
    }
    return;
  }

  // 3. Migrar con concurrencia limitada.
  let ok = 0, over = 0, fail = 0, done = 0;
  const fails = [];
  const queue = [...docs];
  async function worker() {
    while (queue.length) {
      const doc = queue.shift();
      try {
        const bytes = await downloadBytes(sa, byDoc.get(doc).id);
        const p = nameMap.get(doc);
        const name = p ? `lgs ${sanitize(p.primerNombre)} ${sanitize(p.primerApellido)} ${sanitize(p.numeroId)}.pdf` : `${doc}.pdf`;
        const res = await uploadToNew(sa, bytes, name, doc);
        ok++; if (res.overwrote) over++;
      } catch (e) {
        fail++; fails.push({ doc, error: e.message });
      }
      if (++done % 100 === 0) console.log(`   … ${done}/${docs.length} (ok=${ok} fail=${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n🟢 Migración terminada. Subidos: ${ok} (sobrescritos: ${over}) · fallidos: ${fail}`);
  if (fails.length) {
    console.log('Fallidos (primeros 20):');
    fails.slice(0, 20).forEach(f => console.log(`   ${f.doc}: ${f.error}`));
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
