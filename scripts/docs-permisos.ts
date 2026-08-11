/**
 * docs-permisos.ts — Genera docs/manual/anexos/A-matriz-permisos.md
 *
 * Uso:  npm run docs:permisos
 *
 * Se conecta a la BD vía Prisma (SOLO LECTURA: un único SELECT a ROL_PERMISOS,
 * nunca escribe en BD) y cruza las asignaciones reales con el catálogo de
 * permisos definido en código (src/config/permissions.ts) para producir:
 *   - matriz permiso → roles
 *   - matriz inversa rol → permisos (por módulo)
 *   - sección de Divergencias: HUÉRFANO, FANTASMA, SOLO_BYPASS, SIN_GATE_API
 *
 * SIN_GATE_API se deriva de la auditoría de gates (docs/security/01-auditoria-gates.md
 * o, si no existe, docs/manual/01-auditoria-gates.md), que se lee como entrada.
 *
 * Requisitos cumplidos:
 *   - Salida determinista: todo se ordena estable; el ÚNICO renglón que cambia
 *     entre corridas con la misma BD es la marca de tiempo de generación (así el
 *     diff de git queda legible).
 *   - Si la conexión falla → exit code ≠ 0 y NO se deja el archivo a medias
 *     (se arma todo el contenido en memoria y se escribe atómico: tmp + rename).
 *   - Cero credenciales embebidas: la conexión sale de DATABASE_URL (.env.local).
 */

import { PrismaClient } from '@prisma/client';
import { PERMISSIONS_CATALOG } from '@/config/permissions';
import { Module } from '@/types/permissions';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// Cargar variables de entorno del proyecto (Prisma lee DATABASE_URL de aquí).
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback a .env si existiera; no sobrescribe lo ya cargado

const REPO_ROOT = process.cwd();
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'manual', 'anexos', 'A-matriz-permisos.md');
const AUDIT_CANDIDATES = [
  path.join(REPO_ROOT, 'docs', 'security', '01-auditoria-gates.md'),
  path.join(REPO_ROOT, 'docs', 'manual', '01-auditoria-gates.md'),
];

const BYPASS_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

// Orden de módulos = orden de declaración del enum Module (determinista).
const MODULE_ORDER: string[] = Object.values(Module);
function moduleRank(m: string): number {
  const i = MODULE_ORDER.indexOf(m);
  return i === -1 ? MODULE_ORDER.length : i;
}

type RolPermisoRow = { rol: string; permisos: unknown; activo: boolean | null };

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Extrae los códigos de permiso de las secciones A–D de la auditoría de gates. */
function parseSinGateApi(catalogCodes: Set<string>): { codes: string[]; sourceRel: string | null; note: string } {
  const src = AUDIT_CANDIDATES.find((p) => fs.existsSync(p));
  if (!src) {
    return { codes: [], sourceRel: null, note: 'archivo de auditoría no encontrado — sección no evaluada' };
  }
  const text = fs.readFileSync(src, 'utf8');
  const rel = path.relative(REPO_ROOT, src).split(path.sep).join('/');
  // Región de "gaps reales": desde la sección A hasta la E (excluida).
  const start = text.indexOf('## 🔴 A');
  const end = text.indexOf('## 🟡 E');
  if (start === -1 || end === -1 || end <= start) {
    return { codes: [], sourceRel: rel, note: `no se hallaron las secciones A–D en ${rel} — sección no evaluada` };
  }
  const region = text.slice(start, end);
  const re = /[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+){1,3}/g;
  const found = new Set<string>();
  for (const m of region.matchAll(re)) {
    if (catalogCodes.has(m[0])) found.add(m[0]);
  }
  return { codes: [...found].sort(), sourceRel: rel, note: `derivado de las secciones A–D de ${rel}` };
}

function redactedTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return '(DATABASE_URL no definida)';
  try {
    const u = new URL(raw);
    const db = u.pathname.replace(/^\//, '') || '(default)';
    return `${u.hostname}:${u.port || '5432'}/${db}`; // sin usuario ni contraseña
  } catch {
    return '(DATABASE_URL con formato no parseable)';
  }
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|');
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definida (revisá .env.local). No se puede consultar la BD.');
  }

  // --- Catálogo en código (fuente de verdad de "qué permisos existen") ---
  const catalog = [...PERMISSIONS_CATALOG].map((p) => ({
    code: String(p.code),
    module: String(p.module),
    section: String(p.section ?? ''),
    name: String(p.name ?? ''),
  }));
  const catalogCodes = new Set(catalog.map((p) => p.code));
  const moduleByCode = new Map(catalog.map((p) => [p.code, p.module] as const));

  // --- Consulta SOLO LECTURA a ROL_PERMISOS ---
  const prisma = new PrismaClient();
  let rows: RolPermisoRow[];
  try {
    rows = await prisma.$queryRaw<RolPermisoRow[]>`
      SELECT "rol", "permisos", "activo" FROM "ROL_PERMISOS"
    `;
  } finally {
    await prisma.$disconnect();
  }

  const inactiveRoles = rows
    .filter((r) => r.activo === false)
    .map((r) => r.rol)
    .sort();
  const activeRows = rows.filter((r) => r.activo !== false);
  const roles = activeRows.map((r) => r.rol).sort();

  // permisos por rol (solo activos)
  const permsByRole = new Map<string, string[]>();
  for (const r of activeRows) permsByRole.set(r.rol, [...new Set(asStringArray(r.permisos))].sort());

  // roles por código (todos los códigos asignados, sean o no del catálogo)
  const rolesByCode = new Map<string, string[]>();
  for (const r of activeRows) {
    for (const code of asStringArray(r.permisos)) {
      if (!rolesByCode.has(code)) rolesByCode.set(code, []);
      const list = rolesByCode.get(code)!;
      if (!list.includes(r.rol)) list.push(r.rol);
    }
  }
  for (const list of rolesByCode.values()) list.sort();

  const nonBypassRolesHaving = (code: string): string[] =>
    (rolesByCode.get(code) ?? []).filter((r) => !BYPASS_ROLES.has(r));
  const bypassRolesHaving = (code: string): string[] =>
    (rolesByCode.get(code) ?? []).filter((r) => BYPASS_ROLES.has(r));

  // --- Divergencias ---
  // HUÉRFANO: código del catálogo que NINGÚN rol tiene asignado.
  const huerfanos = catalog
    .filter((p) => (rolesByCode.get(p.code) ?? []).length === 0)
    .map((p) => p.code)
    .sort();

  // SOLO_BYPASS: código del catálogo que solo tienen roles bypass (SUPER_ADMIN/ADMIN)
  // y al menos uno lo tiene explícito (≥1 bypass, 0 no-bypass). Disjunto de HUÉRFANO.
  const soloBypass = catalog
    .filter((p) => nonBypassRolesHaving(p.code).length === 0 && bypassRolesHaving(p.code).length > 0)
    .map((p) => p.code)
    .sort();

  // FANTASMA: código asignado en BD que NO existe en el catálogo del código.
  const fantasmas = [...rolesByCode.keys()].filter((code) => !catalogCodes.has(code)).sort();

  // SIN_GATE_API: permisos que gatean una pantalla cuyo endpoint de escritura no revalida.
  const sinGate = parseSinGateApi(catalogCodes);

  // --- Construcción del Markdown (todo en memoria; escritura atómica al final) ---
  const generatedAtUtc = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const target = redactedTarget();
  const L: string[] = [];

  L.push('# Anexo A — Matriz de permisos (permiso ↔ rol)');
  L.push('');
  L.push('> ⚠️ **Archivo autogenerado por `npm run docs:permisos` — NO editar a mano.**');
  L.push('> Se regenera cruzando el catálogo de permisos en código (`src/config/permissions.ts`)');
  L.push('> con las asignaciones reales de la tabla `ROL_PERMISOS` (consulta de solo lectura).');
  L.push('');
  L.push(`- **Generado:** ${generatedAtUtc}`);
  L.push(`- **Entorno consultado:** \`${target}\``);
  L.push(`- **Fuente del catálogo:** \`src/config/permissions.ts\` (\`PERMISSIONS_CATALOG\`)`);
  L.push(`- **Fuente de asignaciones:** tabla \`ROL_PERMISOS\` (solo roles \`activo = true\`)`);
  L.push(`- **Fuente de SIN_GATE_API:** ${sinGate.sourceRel ? `\`${sinGate.sourceRel}\`` : '(no disponible)'}`);
  if (inactiveRoles.length) {
    L.push(`- **Roles inactivos excluidos (${inactiveRoles.length}):** ${inactiveRoles.join(', ')}`);
  }
  L.push('');
  L.push('> Nota: `SUPER_ADMIN` y `ADMIN` tienen **bypass total** por código (middleware / `PermissionGuard`),');
  L.push('> así que acceden a todo aunque un permiso no figure en su fila de `ROL_PERMISOS`.');
  L.push('');

  // --- Resumen numérico ---
  L.push('## Resumen');
  L.push('');
  L.push('| Métrica | Valor |');
  L.push('|---|---:|');
  L.push(`| Permisos en el catálogo (código) | ${catalog.length} |`);
  L.push(`| Roles activos en \`ROL_PERMISOS\` | ${roles.length} |`);
  L.push(`| 🟥 HUÉRFANO (en catálogo, sin ningún rol) | ${huerfanos.length} |`);
  L.push(`| 👻 FANTASMA (en BD, fuera del catálogo) | ${fantasmas.length} |`);
  L.push(`| 🔒 SOLO_BYPASS (solo SUPER_ADMIN/ADMIN) | ${soloBypass.length} |`);
  L.push(`| 🚪 SIN_GATE_API (pantalla gateada, endpoint no revalida) | ${sinGate.codes.length} |`);
  L.push('');

  // --- Divergencias (el valor real del anexo) ---
  L.push('## Divergencias');
  L.push('');

  L.push('### 🟥 HUÉRFANO — permiso del catálogo que ningún rol tiene');
  L.push('');
  L.push('_Existe en `PERMISSIONS_CATALOG` pero no está asignado a ningún rol en `ROL_PERMISOS` (solo accesible por bypass SUPER_ADMIN/ADMIN)._');
  L.push('');
  if (huerfanos.length) {
    L.push('| Código | Módulo |');
    L.push('|---|---|');
    for (const code of huerfanos) L.push(`| \`${code}\` | ${moduleByCode.get(code) ?? ''} |`);
  } else {
    L.push('_Ninguno._');
  }
  L.push('');

  L.push('### 👻 FANTASMA — permiso asignado en BD que no existe en el catálogo');
  L.push('');
  L.push('_Aparece en `ROL_PERMISOS.permisos` de algún rol pero no está en `PERMISSIONS_CATALOG` (código eliminado/renombrado, o typo en la BD)._');
  L.push('');
  if (fantasmas.length) {
    L.push('| Código (fantasma) | Roles que lo tienen |');
    L.push('|---|---|');
    for (const code of fantasmas) L.push(`| \`${code}\` | ${(rolesByCode.get(code) ?? []).join(', ')} |`);
  } else {
    L.push('_Ninguno._');
  }
  L.push('');

  L.push('### 🔒 SOLO_BYPASS — accesible únicamente por SUPER_ADMIN/ADMIN');
  L.push('');
  L.push('_Ningún rol operativo (no-bypass) lo tiene, pero está asignado explícitamente a SUPER_ADMIN y/o ADMIN. En la práctica solo esos roles lo usan._');
  L.push('');
  if (soloBypass.length) {
    L.push('| Código | Módulo | Roles bypass que lo tienen |');
    L.push('|---|---|---|');
    for (const code of soloBypass) L.push(`| \`${code}\` | ${moduleByCode.get(code) ?? ''} | ${bypassRolesHaving(code).join(', ')} |`);
  } else {
    L.push('_Ninguno._');
  }
  L.push('');

  L.push('### 🚪 SIN_GATE_API — pantalla gateada cuyo endpoint de escritura no revalida el permiso');
  L.push('');
  L.push(`_${sinGate.note}. El permiso protege la pantalla en el cliente, pero el handler de escritura solo exige sesión (o es público), por lo que una llamada directa lo salta._`);
  L.push('');
  if (sinGate.codes.length) {
    L.push('| Código | Módulo | Roles que lo tienen |');
    L.push('|---|---|---|');
    for (const code of sinGate.codes) L.push(`| \`${code}\` | ${moduleByCode.get(code) ?? ''} | ${(rolesByCode.get(code) ?? []).join(', ') || '— (ninguno)'} |`);
  } else {
    L.push('_Ninguno detectado con los marcadores actuales._');
  }
  L.push('');

  // --- Matriz permiso → roles (por módulo, luego alfabética) ---
  L.push('## Matriz permiso → roles');
  L.push('');
  L.push('_Una fila por código del catálogo, con los roles que hoy lo tienen en `ROL_PERMISOS`. Ordenada por módulo y luego alfabéticamente por código._');
  L.push('');
  const catalogSorted = [...catalog].sort((a, b) => {
    const dm = moduleRank(a.module) - moduleRank(b.module);
    return dm !== 0 ? dm : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
  let curModule = '';
  for (const p of catalogSorted) {
    if (p.module !== curModule) {
      curModule = p.module;
      L.push(`### ${curModule}`);
      L.push('');
      L.push('| Código | Roles con el permiso |');
      L.push('|---|---|');
    }
    const rs = rolesByCode.get(p.code) ?? [];
    L.push(`| \`${p.code}\` | ${rs.length ? rs.join(', ') : '— (ninguno)'} |`);
    // cerrar bloque de tabla con línea en blanco cuando cambia el módulo:
    // (se añade al detectar cambio arriba; el join final deja el md válido)
    const next = catalogSorted[catalogSorted.indexOf(p) + 1];
    if (!next || next.module !== p.module) L.push('');
  }

  // --- Matriz inversa rol → permisos (por módulo) ---
  L.push('## Matriz inversa rol → permisos');
  L.push('');
  L.push('_Para consulta operativa: qué permisos tiene hoy cada rol activo, agrupados por módulo. `SUPER_ADMIN`/`ADMIN` acceden a todo por bypass además de lo listado._');
  L.push('');
  for (const rol of roles) {
    const perms = permsByRole.get(rol) ?? [];
    L.push(`### ${rol}  (${perms.length} permisos)`);
    if (!perms.length) {
      L.push('');
      L.push('_Sin permisos asignados._');
      L.push('');
      continue;
    }
    // agrupar por módulo (catálogo); fantasmas al final
    const byModule = new Map<string, string[]>();
    const ghosts: string[] = [];
    for (const code of perms) {
      const mod = moduleByCode.get(code);
      if (!mod) { ghosts.push(code); continue; }
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod)!.push(code);
    }
    L.push('');
    const mods = [...byModule.keys()].sort((a, b) => moduleRank(a) - moduleRank(b));
    for (const mod of mods) {
      const codes = byModule.get(mod)!.slice().sort();
      L.push(`- **${mod}**: ${codes.map((c) => `\`${c}\``).join(', ')}`);
    }
    if (ghosts.length) {
      L.push(`- **(fuera de catálogo 👻)**: ${ghosts.slice().sort().map((c) => `\`${c}\``).join(', ')}`);
    }
    L.push('');
  }

  const content = L.join('\n').replace(/\n+$/, '') + '\n';

  // --- Escritura atómica: tmp + rename (nunca deja el archivo a medias) ---
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const tmp = `${OUT_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, OUT_PATH);

  const relOut = path.relative(REPO_ROOT, OUT_PATH).split(path.sep).join('/');
  console.log(`✅ Generado ${relOut}`);
  console.log(`   ${catalog.length} permisos · ${roles.length} roles · HUÉRFANO ${huerfanos.length} · FANTASMA ${fantasmas.length} · SOLO_BYPASS ${soloBypass.length} · SIN_GATE_API ${sinGate.codes.length}`);
}

main().catch((err) => {
  console.error('❌ docs:permisos falló — no se escribió el archivo.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
