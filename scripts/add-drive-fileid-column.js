#!/usr/bin/env node
/**
 * add-drive-fileid-column.js — Agrega PEOPLE."driveFileId" (VARCHAR, nullable).
 *
 * Guarda el fileId de Google Drive del contrato del titular. La descarga
 * (/api/contracts/[id]/download-pdf) lo lee DIRECTO por id (consistencia fuerte)
 * en vez de buscarlo por appProperties (que va con retraso por la eventual
 * consistencia del índice de búsqueda de Drive). Se llena al generar/subir el PDF
 * en modo LGS (archivarContratoEnDrive).
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Dry-run por defecto.
 * USO: node scripts/add-drive-fileid-column.js [--apply]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const APPLY = process.argv.includes('--apply');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  console.log(`\n===== ADD PEOPLE.driveFileId (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  const exists = (await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='PEOPLE' AND column_name='driveFileId' LIMIT 1`)).rowCount > 0;
  console.log(`Columna driveFileId existe: ${exists ? 'sí' : 'no'}`);

  if (!APPLY) { console.log(`\n[dry-run] usa --apply para crear la columna`); await c.end(); return; }

  await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "driveFileId" VARCHAR(255)`);
  const n = (await c.query(`SELECT COUNT(*)::int total, COUNT("driveFileId")::int con_fileid FROM "PEOPLE"`)).rows[0];
  console.log(`🟢 Columna lista. PEOPLE: ${n.total} · con driveFileId: ${n.con_fileid}`);
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
