/**
 * Normaliza a Nombre Propio los nombres y apellidos YA guardados que tienen errores de
 * digitación. Misma regla que src/lib/formato-campos.ts (nombrePropio), con este alcance
 * (decisión del 2026-10-30):
 *
 *   - Espacios sobrantes o dobles ("SEBASTIAN ", "Juan  Carlos")  → se limpian
 *   - Todo en minúsculas ("juan perez")                           → Nombre Propio
 *   - Mezcla ("Sergio andres", "Del carmen")                      → Nombre Propio
 *   - Todo en MAYÚSCULAS ("JUAN PEREZ")                           → NO se cambia (solo se
 *     le quitan los espacios sobrantes): es el formato histórico
 *
 * Incluye contratos firmados (su PDF en Drive conserva el nombre anterior).
 * Tablas: PEOPLE y ACADEMICA (4 campos; en PEOPLE se rehace nombreCompleto si lo tiene),
 * ACADEMICA_BOOKINGS (copia del nombre en cada clase) y USUARIOS_ROLES (nombre, apellido).
 * La razón social de un titular Empresa (PEOPLE.primerNombre) no se toca.
 *
 * Uso:  node scripts/normalizar-nombres.js            (dry-run: cuenta + reporte)
 *       node scripts/normalizar-nombres.js --apply    (respaldo en docs/ + lotes en transacción)
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const LOTE = 1000;

// ── Regla (copia de src/lib/formato-campos.ts → nombrePropio) ──
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von', 'der']);
const limpiarTexto = (v) => v.replace(/\s+/g, ' ').trim();
const capitalizar = (w) => {
  for (let i = 0; i < w.length; i++) {
    const ch = w.charAt(i);
    if (ch.toLocaleLowerCase('es') !== ch.toLocaleUpperCase('es')) return w.slice(0, i) + ch.toLocaleUpperCase('es') + w.slice(i + 1);
  }
  return w;
};
function nombrePropio(v) {
  return limpiarTexto(v).toLocaleLowerCase('es').split(' ')
    .map((w, i) => (i > 0 && PARTICULAS.has(w)) ? w : w.split(/([-'’])/).map(capitalizar).join(''))
    .join(' ');
}

/**
 * Modo suave para campos con el NOMBRE COMPLETO en uno solo (USUARIOS_ROLES.nombre):
 * ahí "La Rosa" puede ser un apellido, así que nunca se baja una mayúscula. Solo se
 * capitaliza lo que está en minúscula y se pasa a Nombre Propio la palabra en MAYÚSCULAS
 * suelta (las de ≤3 letras se respetan: LGS, BEG, P1).
 */
function nombreSuave(v) {
  return limpiarTexto(v).split(' ').map((w, i) => {
    const low = w.toLocaleLowerCase('es'), up = w.toLocaleUpperCase('es');
    if (i > 0 && PARTICULAS.has(w)) return w; // del, de la… en minúscula se respetan
    if (w === low) return w.split(/([-'’])/).map(capitalizar).join('');
    if (w === up && w.length > 3) return low.split(/([-'’])/).map(capitalizar).join('');
    return w;
  }).join(' ');
}

const RAZON_SOCIAL = /\b(SPA|S\.?A\.?S\.?|LTDA|EIRL|S\.A\.)(\b|$)/i;

/** Valor corregido, o null si no se toca. Devuelve también el tipo de problema. */
function corregir(v, suave = false) {
  if (typeof v !== 'string' || !v.trim()) return null;
  if (RAZON_SOCIAL.test(v)) return null; // razón social: no se toca
  const propio = suave ? nombreSuave(v) : nombrePropio(v);
  if (propio === v) return null;
  const limpio = limpiarTexto(v);
  const esMayus = limpio === limpio.toLocaleUpperCase('es') && limpio !== limpio.toLocaleLowerCase('es');
  if (esMayus) return limpio !== v ? { valor: limpio, tipo: 'mayusculas (solo espacios)' } : null;
  const tipo = limpio === propio ? 'espacios' : limpio === limpio.toLocaleLowerCase('es') ? 'minusculas' : 'mixto';
  return { valor: propio, tipo };
}

const TABLAS = [
  { t: 'PEOPLE', campos: ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'], extra: `"tipoUsuario", "tipoPersona", "nombreCompleto"` },
  { t: 'ACADEMICA', campos: ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'] },
  { t: 'ACADEMICA_BOOKINGS', campos: ['primerNombre', 'primerApellido'] },
  { t: 'USUARIOS_ROLES', campos: ['nombre', 'apellido'], suave: true },
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cambios = []; // { t, _id, campo, antes, despues, tipo }
  const reporte = [];

  for (const { t, campos, extra, suave } of TABLAS) {
    const rows = (await c.query(`SELECT "_id", ${campos.map(k => `"${k}"`).join(', ')}${extra ? ', ' + extra : ''} FROM "${t}"`)).rows;
    const stat = { filas: rows.length, filasCambian: 0 };
    for (const r of rows) {
      const nuevos = {};
      for (const k of campos) {
        if (t === 'PEOPLE' && k === 'primerNombre' && r.tipoUsuario === 'TITULAR' && r.tipoPersona === 'Empresa') continue;
        const x = corregir(r[k], suave);
        if (!x) continue;
        nuevos[k] = x.valor;
        cambios.push({ t, _id: r._id, campo: k, antes: r[k], despues: x.valor, tipo: x.tipo });
        stat[x.tipo] = (stat[x.tipo] || 0) + 1;
        if (x.tipo === 'mixto') reporte.push(`${t}.${k}: "${r[k]}" → "${x.valor}"`);
      }
      if (!Object.keys(nuevos).length) continue;
      stat.filasCambian++;
      // PEOPLE.nombreCompleto: se rehace con los 4 campos (misma regla que el cron sync-nombrecompleto)
      if (t === 'PEOPLE' && r.nombreCompleto && r.nombreCompleto.trim()) {
        const v = (k) => (nuevos[k] ?? r[k] ?? '');
        const completo = limpiarTexto([v('primerNombre'), v('segundoNombre'), v('primerApellido'), v('segundoApellido')].join(' '));
        if (completo !== r.nombreCompleto) cambios.push({ t, _id: r._id, campo: 'nombreCompleto', antes: r.nombreCompleto, despues: completo, tipo: 'nombreCompleto' });
      }
    }
    console.log(t, stat);
  }

  const out = `${process.env.TEMP || '.'}/normalizar-nombres-mixtos.txt`;
  fs.writeFileSync(out, reporte.join('\n'));
  console.log(`\nTotal de campos a cambiar: ${cambios.length}. Cambios "mixto" (revisar): ${out}`);

  if (!APPLY) { console.log('\nDRY-RUN: no se escribió nada. Use --apply para aplicar.'); await c.end(); return; }

  const backup = `docs/backup-normalizar-nombres-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify(cambios));
  console.log('Respaldo:', backup);

  // Agrupar por tabla+campo y aplicar en lotes, cada lote en su transacción.
  const grupos = {};
  for (const x of cambios) (grupos[`${x.t}|${x.campo}`] ||= []).push(x);
  for (const [clave, lista] of Object.entries(grupos)) {
    const [t, campo] = clave.split('|');
    let hechos = 0;
    for (let i = 0; i < lista.length; i += LOTE) {
      const lote = lista.slice(i, i + LOTE);
      await c.query('BEGIN');
      try {
        const r = await c.query(
          `UPDATE "${t}" x SET "${campo}" = v.val FROM unnest($1::text[], $2::text[], $3::text[]) v(id, val, antes)
           WHERE x."_id" = v.id AND x."${campo}" IS NOT DISTINCT FROM v.antes`,
          [lote.map(z => z._id), lote.map(z => z.despues), lote.map(z => z.antes)]);
        await c.query('COMMIT');
        hechos += r.rowCount;
        console.log(`${t}.${campo}: ${hechos}/${lista.length}`);
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    }
  }
  console.log('\nListo.');
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
