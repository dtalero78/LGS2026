/**
 * Solo lectura. Audita la tabla ROL_PERMISOS:
 *  - Esquema de columnas
 *  - Volcado de filas (rol, activo, descripcion, # permisos, fechas)
 *  - Consistencia interna (roles duplicados, campos nulos/vacios,
 *    arrays de permisos vacios, permisos duplicados dentro de un rol)
 *  - Cruce contra el catalogo de permisos y roles definido en
 *    src/types/permissions.ts (permisos desconocidos, roles huerfanos)
 *  - Cruce contra USUARIOS_ROLES (roles usados sin definicion)
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// ── Catalogo desde el codigo (fuente de verdad de permisos validos) ──
function loadCodeCatalog() {
  const file = path.join(__dirname, '..', 'src', 'types', 'permissions.ts');
  const src = fs.readFileSync(file, 'utf8');

  // Permisos: cualquier string en mayusculas con al menos un punto
  const permRe = /'([A-Z][A-Z0-9_]*\.[A-Z0-9_.]+)'/g;
  const validPerms = new Set();
  let m;
  while ((m = permRe.exec(src)) !== null) validPerms.add(m[1]);

  // Roles: bloque "export enum Role { ... }"
  const roleBlock = src.match(/export enum Role\s*\{([\s\S]*?)\}/);
  const validRoles = new Set();
  if (roleBlock) {
    const roleRe = /=\s*'([^']+)'/g;
    while ((m = roleRe.exec(roleBlock[1])) !== null) validRoles.add(m[1]);
  }
  return { validPerms, validRoles };
}

function asArray(permisos) {
  if (Array.isArray(permisos)) return permisos;
  if (permisos == null) return null;
  if (typeof permisos === 'string') {
    try { const p = JSON.parse(permisos); return Array.isArray(p) ? p : [permisos]; }
    catch { return [permisos]; }
  }
  return null;
}

(async () => {
  const { validPerms, validRoles } = loadCodeCatalog();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    // 1) Esquema
    const schema = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ROL_PERMISOS'
      ORDER BY ordinal_position
    `);
    console.log('═══ ESQUEMA ROL_PERMISOS ═══');
    for (const c of schema.rows) {
      console.log(`  ${c.column_name.padEnd(16)} ${c.data_type.padEnd(28)} nullable=${c.is_nullable} default=${c.column_default || '-'}`);
    }

    // 2) Filas
    const { rows } = await pool.query(`SELECT * FROM "ROL_PERMISOS" ORDER BY "rol"`);
    console.log(`\n═══ FILAS (${rows.length}) ═══`);
    console.log('  ROL'.padEnd(26) + 'ACT  #PERM  DESCRIPCION');
    for (const r of rows) {
      const arr = asArray(r.permisos);
      const n = arr ? arr.length : 'NULL';
      const desc = (r.descripcion || '').slice(0, 40);
      console.log(`  ${String(r.rol).padEnd(24)}${String(r.activo).padEnd(5)}${String(n).padEnd(7)}${desc}`);
    }

    // 3) Consistencia interna
    console.log('\n═══ CONSISTENCIA INTERNA ═══');
    const issues = [];
    const rolCount = {};
    for (const r of rows) {
      rolCount[r.rol] = (rolCount[r.rol] || 0) + 1;
      if (!r.rol || String(r.rol).trim() === '') issues.push(`rol nulo/vacio en fila _id=${r._id}`);
      if (r.activo === null || r.activo === undefined) issues.push(`activo NULL en rol=${r.rol}`);
      if (!r.descripcion || String(r.descripcion).trim() === '') issues.push(`descripcion vacia en rol=${r.rol}`);
      const arr = asArray(r.permisos);
      if (arr === null) { issues.push(`permisos NULL/no-array en rol=${r.rol}`); continue; }
      if (arr.length === 0) issues.push(`permisos vacio [] en rol=${r.rol}`);
      const seen = new Set(), dups = new Set();
      for (const p of arr) {
        if (p == null || p === '') issues.push(`permiso vacio dentro de rol=${r.rol}`);
        if (seen.has(p)) dups.add(p); else seen.add(p);
      }
      if (dups.size) issues.push(`permisos DUPLICADOS en rol=${r.rol}: ${[...dups].join(', ')}`);
    }
    for (const [rol, c] of Object.entries(rolCount)) if (c > 1) issues.push(`rol DUPLICADO (${c} filas): ${rol}`);
    console.log(issues.length ? issues.map(i => '  ⚠ ' + i).join('\n') : '  ✓ sin problemas internos');

    // 4) Cruce con catalogo de codigo
    console.log('\n═══ CRUCE CON CODIGO (src/types/permissions.ts) ═══');
    console.log(`  Catalogo: ${validPerms.size} permisos validos, ${validRoles.size} roles definidos`);

    const unknownByRole = {};
    const allAssigned = new Set();
    for (const r of rows) {
      const arr = asArray(r.permisos) || [];
      for (const p of arr) {
        allAssigned.add(p);
        if (!validPerms.has(p)) (unknownByRole[r.rol] = unknownByRole[r.rol] || []).push(p);
      }
    }
    console.log('\n  ── Permisos en BD que NO existen en el codigo (stale/typo) ──');
    const uk = Object.entries(unknownByRole);
    if (!uk.length) console.log('    ✓ ninguno');
    else for (const [rol, ps] of uk) console.log(`    ${rol}: ${[...new Set(ps)].join(', ')}`);

    console.log('\n  ── Roles en BD que NO estan en el enum Role ──');
    const orphanRoles = rows.map(r => r.rol).filter(r => !validRoles.has(r));
    console.log(orphanRoles.length ? '    ⚠ ' + orphanRoles.join(', ') : '    ✓ ninguno');

    console.log('\n  ── Roles del enum Role SIN fila en ROL_PERMISOS ──');
    const dbRoles = new Set(rows.map(r => r.rol));
    const missingRoles = [...validRoles].filter(r => !dbRoles.has(r));
    console.log(missingRoles.length ? '    ⚠ ' + missingRoles.join(', ') : '    ✓ ninguno');

    console.log('\n  ── Permisos del codigo NO asignados a NINGUN rol (informativo) ──');
    const neverUsed = [...validPerms].filter(p => !allAssigned.has(p)).sort();
    console.log(`    (${neverUsed.length}) ` + (neverUsed.length ? neverUsed.join(', ') : 'ninguno'));

    // 5) Cruce con USUARIOS_ROLES
    console.log('\n═══ CRUCE CON USUARIOS_ROLES ═══');
    const ur = await pool.query(`
      SELECT "rol", COUNT(*)::int AS usuarios
      FROM "USUARIOS_ROLES"
      WHERE "rol" IS NOT NULL AND "rol" <> ''
      GROUP BY "rol" ORDER BY usuarios DESC
    `);
    console.log('  Roles en uso (USUARIOS_ROLES) y si tienen definicion en ROL_PERMISOS:');
    for (const u of ur.rows) {
      const def = dbRoles.has(u.rol) ? '✓ definido' : '⚠ SIN definicion en ROL_PERMISOS';
      console.log(`    ${String(u.rol).padEnd(24)} ${String(u.usuarios).padEnd(7)} ${def}`);
    }
  } finally {
    await pool.end();
  }
})();
