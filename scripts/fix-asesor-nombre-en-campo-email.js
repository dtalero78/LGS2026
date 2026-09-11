#!/usr/bin/env node
/**
 * fix-asesor-nombre-en-campo-email.js — normaliza los TITULAR donde
 * `PEOPLE.asesor` guarda un NOMBRE en vez del EMAIL del comercial.
 *
 * CAUSA: el paso 1 de "Crear Contrato" tenía una sola casilla rotulada
 * "Nombre del asesor" que escribía en `asesor` (que es el campo del EMAIL).
 * El nombre real vive en `asesorCreadorContrato`. Como `getAsesorInfo()`
 * resuelve el comercial buscando `asesor` COMO EMAIL en USUARIOS_ROLES, esos
 * contratos salen con el nombre repetido en la línea del correo.
 *
 * QUÉ HACE (solo filas con `asesor` que NO parece email):
 *   1. `asesorCreadorContrato` = el nombre (solo si está vacío) → lo deja en su campo.
 *   2. Intenta resolver el EMAIL a partir del nombre (CRM "User" + USUARIOS_ROLES).
 *      Si lo encuentra (match ÚNICO) → `asesor` = email.
 *   3. Si NO lo resuelve → **deja `asesor` como está** (el nombre) y lo reporta.
 *      OJO: no se limpia a propósito. Si se pusiera NULL, `getAsesorInfo()`
 *      devolvería null y el bloque del asesor DESAPARECERÍA del contrato; es
 *      preferible el nombre repetido (comportamiento actual) a perder el dato.
 *
 * Idempotente: al terminar, las filas resueltas ya tienen email en `asesor` y
 * no vuelven a entrar al filtro. Dry-run por defecto.
 *
 * REPORTES (docs/, gitignored):
 *   docs/asesor-nombre-resueltos.csv     → los que se pudieron mapear a email
 *   docs/asesor-nombre-sin-resolver.csv  → para revisión manual
 *
 * USO:
 *   export CRM_URI=$(doctl databases connection <lgs-crm-db-id> --format URI --no-header)
 *   node scripts/fix-asesor-nombre-en-campo-email.js            # dry-run
 *   node scripts/fix-asesor-nombre-en-campo-email.js --apply    # aplica
 *   (CRM_URI es OPCIONAL: sin él solo resuelve contra USUARIOS_ROLES)
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const mk = uri => new Client({
  connectionString: uri.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Agrega nombre→email al mapa. Marca como ambiguo si el nombre ya existe con otro email. */
function addName(map, nombre, email) {
  const k = norm(nombre);
  if (!k || !isEmail(email)) return;
  const prev = map.get(k);
  if (prev && prev.email !== email.toLowerCase()) { prev.ambiguo = true; return; }
  if (!prev) map.set(k, { email: email.toLowerCase().trim(), ambiguo: false });
}

const csv = (file, rows, header) => {
  const dir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(path.join(dir, file),
    [header.join(';'), ...rows.map(r => header.map(h => esc(r[h])).join(';'))].join('\n'), 'latin1');
};

(async () => {
  const lgs = mk(process.env.DATABASE_URL);
  await lgs.connect();
  console.log(`\n===== FIX asesor(nombre) → asesorCreadorContrato + email (${APPLY ? 'APPLY' : 'DRY-RUN'}) =====`);

  // ── Mapa nombre → email ──
  const map = new Map();
  let crmCount = 0;
  if (process.env.CRM_URI) {
    const crm = mk(process.env.CRM_URI);
    await crm.connect();
    const rows = (await crm.query(
      `SELECT TRIM(CONCAT_WS(' ', "firstName", "lastName")) AS nombre, "email"
         FROM "User" WHERE "email" IS NOT NULL`
    )).rows;
    rows.forEach(r => addName(map, r.nombre, r.email));
    crmCount = rows.length;
    await crm.end();
  } else {
    console.log('⚠️  Sin CRM_URI — solo se resuelve contra USUARIOS_ROLES (menos matches).');
  }
  const urRows = (await lgs.query(
    `SELECT TRIM(CONCAT_WS(' ', "nombre", "apellido")) AS nombre, "email"
       FROM "USUARIOS_ROLES" WHERE "email" IS NOT NULL`
  )).rows;
  urRows.forEach(r => addName(map, r.nombre, r.email));
  console.log(`\nCRM Users: ${crmCount} · USUARIOS_ROLES: ${urRows.length} · nombres únicos mapeados: ${map.size}`);

  // ── Titulares con NOMBRE en `asesor` ──
  const targets = (await lgs.query(
    `SELECT "_id", "contrato", "asesor", COALESCE("asesorCreadorContrato",'') AS creador
       FROM "PEOPLE"
      WHERE "tipoUsuario" = 'TITULAR'
        AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
        AND "asesor" IS NOT NULL AND TRIM("asesor") <> ''
        AND "asesor" NOT LIKE '%@%'`
  )).rows;
  console.log(`Titulares con NOMBRE en "asesor": ${targets.length}`);

  const resueltos = [], sinResolver = [];
  for (const t of targets) {
    const hit = map.get(norm(t.asesor));
    if (hit && !hit.ambiguo) {
      resueltos.push({ _id: t._id, contrato: t.contrato, nombre: t.asesor, email: hit.email, creadorPrevio: t.creador });
    } else {
      sinResolver.push({
        _id: t._id, contrato: t.contrato, nombre: t.asesor,
        motivo: hit?.ambiguo ? 'nombre ambiguo (2+ emails)' : 'nombre no hallado en CRM/USUARIOS_ROLES',
      });
    }
  }
  console.log(`  → email resuelto (se corrige por completo): ${resueltos.length}`);
  console.log(`  → sin resolver (solo se copia el nombre; "asesor" queda igual): ${sinResolver.length}`);

  csv('asesor-nombre-resueltos.csv', resueltos, ['_id', 'contrato', 'nombre', 'email', 'creadorPrevio']);
  csv('asesor-nombre-sin-resolver.csv', sinResolver, ['_id', 'contrato', 'nombre', 'motivo']);
  console.log('\nReportes → docs/asesor-nombre-resueltos.csv · docs/asesor-nombre-sin-resolver.csv');

  if (!APPLY) { console.log('\n🟡 DRY-RUN. Para aplicar: node scripts/fix-asesor-nombre-en-campo-email.js --apply'); await lgs.end(); return; }

  await lgs.query('BEGIN');
  try {
    // 1. El nombre va a su campo (solo si está vacío — no pisa lo que venga del CRM).
    const copiados = await lgs.query(
      `UPDATE "PEOPLE"
          SET "asesorCreadorContrato" = "asesor", "_updatedDate" = NOW()
        WHERE "tipoUsuario" = 'TITULAR'
          AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
          AND "asesor" IS NOT NULL AND TRIM("asesor") <> '' AND "asesor" NOT LIKE '%@%'
          AND COALESCE("asesorCreadorContrato",'') = ''`
    );
    // 2. Donde se resolvió el email, `asesor` pasa a ser el email.
    let emails = 0;
    for (const r of resueltos) {
      const res = await lgs.query(
        `UPDATE "PEOPLE" SET "asesor" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
        [r.email, r._id]
      );
      emails += res.rowCount;
    }
    await lgs.query('COMMIT');
    console.log(`\n🟢 APPLY: nombre copiado a asesorCreadorContrato: ${copiados.rowCount} · "asesor" → email: ${emails}`);
  } catch (e) {
    await lgs.query('ROLLBACK');
    throw e;
  }

  const restantes = (await lgs.query(
    `SELECT COUNT(*)::int AS n FROM "PEOPLE"
      WHERE "tipoUsuario"='TITULAR' AND COALESCE("contrato",'') NOT LIKE 'PRB-%'
        AND "asesor" IS NOT NULL AND TRIM("asesor")<>'' AND "asesor" NOT LIKE '%@%'`
  )).rows[0].n;
  console.log(`Verificación → titulares con nombre aún en "asesor": ${restantes} (los no resueltos, para revisión manual)`);
  await lgs.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
