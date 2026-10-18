/**
 * upload-book-ess.js
 *
 * Sube a DO Spaces (ACL PRIVADA) los recursos del "Book ESS New" (libro
 * ST00-00, LGS ESSENTIAL v1.0.0) desde el paquete de integración:
 *   - las 88 páginas JPG  → materials/interactive/ST00-00/page-NNN.jpg
 *   - el PDF CORREGIDO    → materials/interactive/ST00-00/LGS_ESSENTIAL.pdf
 *
 * NO sube el PDF original (trae la clave de respuestas), ni data/server-only,
 * ni reference-html. Antes de subir verifica cada archivo contra SHA256SUMS.txt.
 *
 * Uso:
 *   node scripts/upload-book-ess.js [--dir=Books/LGS_ESSENTIAL_integracion_v1]          # dry-run
 *   node scripts/upload-book-ess.js [--dir=...] --apply                                  # sube
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
const DIR = path.resolve(String(args.dir || 'Books/LGS_ESSENTIAL_integracion_v1'));
const APPLY = !!args.apply;
const PREFIX = 'materials/interactive/ST00-00';
const PDF_KEY = `${PREFIX}/LGS_ESSENTIAL.pdf`;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  if (manifest.book_code !== 'ST00-00') throw new Error(`book_code inesperado: ${manifest.book_code}`);

  const sums = new Map(
    fs.readFileSync(path.join(DIR, 'SHA256SUMS.txt'), 'utf8')
      .split(/\r?\n/).filter(Boolean)
      .map((l) => { const [h, ...f] = l.trim().split(/\s+/); return [f.join(' ').replace(/^\*/, ''), h]; }),
  );

  const items = manifest.pages.map((p) => {
    if (!p.object_key.startsWith(`${PREFIX}/page-`)) throw new Error(`object_key fuera del prefijo: ${p.object_key}`);
    return { rel: p.object_key, key: p.object_key, type: 'image/jpeg' };
  });
  items.push({ rel: manifest.pdf_corrected, key: PDF_KEY, type: 'application/pdf' });

  let bytes = 0;
  for (const it of items) {
    const file = path.join(DIR, it.rel);
    if (!fs.existsSync(file)) throw new Error(`Falta el archivo ${it.rel}`);
    const esperado = sums.get(it.rel);
    if (!esperado) throw new Error(`${it.rel} no está en SHA256SUMS.txt`);
    if (sha256(file) !== esperado) throw new Error(`Checksum distinto en ${it.rel}`);
    it.file = file;
    bytes += fs.statSync(file).size;
  }
  console.log(`✔ ${items.length} archivos verificados (${(bytes / 1048576).toFixed(1)} MB): ${items.length - 1} páginas + PDF corregido`);

  const s3 = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT || 'https://sfo3.digitaloceanspaces.com',
    region: process.env.DO_SPACES_REGION || 'sfo3',
    credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
    requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) }),
  });
  const Bucket = process.env.DO_SPACES_BUCKET || 'lgs-bucket';
  const existentes = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `${PREFIX}/`, MaxKeys: 1000 }));
  console.log(`Objetos ya presentes bajo ${PREFIX}/: ${(existentes.Contents || []).length}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN: se subirían ${items.length} objetos privados a ${Bucket}/${PREFIX}/ (use --apply).`);
    console.log(`  ${items[0].key} … ${items[items.length - 2].key}\n  ${PDF_KEY}`);
    return;
  }

  let n = 0;
  for (const it of items) {
    await s3.send(new PutObjectCommand({
      Bucket, Key: it.key, Body: fs.readFileSync(it.file), ContentType: it.type, ACL: 'private',
      CacheControl: 'private, max-age=600',
    }));
    n++;
    if (n % 10 === 0 || n === items.length) console.log(`  subidos ${n}/${items.length}`);
  }
  console.log(`✅ Listo: ${n} objetos privados en ${Bucket}/${PREFIX}/`);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
