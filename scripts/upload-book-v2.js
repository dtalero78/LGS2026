/**
 * upload-book-v2.js
 *
 * Sube a DO Spaces (ACL PRIVADA) los recursos de un libro "New Books" v2
 * (BEGINNER / PRACTICAL / FUNCTIONAL, edición revisada v2) desde su paquete:
 *   - las páginas JPG         → materials/interactive/LGS-<NIVEL>-V2/page-NNN.jpg  (object_key del paquete)
 *   - el PDF revisado          → materials/interactive/LGS-<NIVEL>-V2/LGS_<NIVEL>_revisado.pdf
 *   - los retratos (personajes) → materials/interactive/LGS-<NIVEL>-V2/characters/<Nombre>.png
 *
 * NO sube data/server-only (claves) ni docs. Verifica cada archivo contra SHA256.json.
 *
 * Uso:
 *   node scripts/upload-book-v2.js --libro=beginner|practical|functional            # dry-run
 *   node scripts/upload-book-v2.js --libro=beginner --apply                          # sube
 *   [--dir=Books/LGS_BEGINNER_revisado_v2]   (por defecto se deduce de --libro)
 *
 * Idempotente: re-ejecutar reemplaza los mismos objetos.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) acc[m[1]] = m[2] ?? true;
  return acc;
}, {});
const LIBRO = String(args.libro || '').toUpperCase();
if (!['BEGINNER', 'PRACTICAL', 'FUNCTIONAL'].includes(LIBRO)) {
  console.error('Uso: node scripts/upload-book-v2.js --libro=beginner|practical|functional [--apply]');
  process.exit(1);
}
const DIR = path.resolve(String(args.dir || `Books/LGS_${LIBRO}_revisado_v2`));
const APPLY = !!args.apply;
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const PREFIX = manifest.storage_prefix;
  if (PREFIX !== `materials/interactive/LGS-${LIBRO}-V2`) throw new Error(`storage_prefix inesperado: ${PREFIX}`);
  const sums = JSON.parse(fs.readFileSync(path.join(DIR, 'SHA256.json'), 'utf8'));
  const pages = JSON.parse(fs.readFileSync(path.join(DIR, manifest.pages_file), 'utf8'));

  const items = pages.map((p) => {
    if (!p.object_key.startsWith(`${PREFIX}/page-`)) throw new Error(`object_key fuera del prefijo: ${p.object_key}`);
    return { rel: p.object_key, key: p.object_key, type: 'image/jpeg' };
  });
  const pdf = fs.readdirSync(path.join(DIR, 'pdf')).filter((f) => f.endsWith('.pdf'));
  if (pdf.length !== 1) throw new Error(`Se esperaba 1 PDF en pdf/, hay ${pdf.length}`);
  items.push({ rel: `pdf/${pdf[0]}`, key: `${PREFIX}/${pdf[0]}`, type: 'application/pdf' });
  for (const f of fs.readdirSync(path.join(DIR, 'assets/characters')).filter((f) => f.endsWith('.png'))) {
    items.push({ rel: `assets/characters/${f}`, key: `${PREFIX}/characters/${f}`, type: 'image/png' });
  }

  let bytes = 0;
  for (const it of items) {
    const file = path.join(DIR, it.rel);
    if (!fs.existsSync(file)) throw new Error(`Falta el archivo ${it.rel}`);
    if (!sums[it.rel]) throw new Error(`${it.rel} no está en SHA256.json`);
    if (sha256(file) !== sums[it.rel]) throw new Error(`Checksum distinto en ${it.rel}`);
    it.file = file;
    bytes += fs.statSync(file).size;
  }
  console.log(`✔ ${LIBRO}: ${items.length} archivos verificados (${(bytes / 1048576).toFixed(1)} MB) — ${pages.length} páginas + PDF + ${items.length - pages.length - 1} retratos`);

  const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT || 'https://sfo3.digitaloceanspaces.com',
    region: process.env.DO_SPACES_REGION || 'sfo3',
    credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
    requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
  });
  const Bucket = process.env.DO_SPACES_BUCKET || 'lgs-bucket';
  const ex = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `${PREFIX}/`, MaxKeys: 1000 }));
  console.log(`Objetos ya presentes bajo ${PREFIX}/: ${(ex.Contents || []).length}`);

  if (!APPLY) {
    console.log(`DRY-RUN: se subirían ${items.length} objetos privados a ${Bucket}/${PREFIX}/ (use --apply).`);
    return;
  }
  let n = 0;
  for (const it of items) {
    await s3.send(new PutObjectCommand({
      Bucket, Key: it.key, Body: fs.readFileSync(it.file), ContentType: it.type, ACL: 'private',
      CacheControl: 'private, max-age=600',
    }));
    n++;
    if (n % 25 === 0 || n === items.length) console.log(`  subidos ${n}/${items.length}`);
  }
  console.log(`✅ ${LIBRO}: ${n} objetos privados en ${Bucket}/${PREFIX}/`);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
