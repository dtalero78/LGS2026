#!/usr/bin/env node
/**
 * export-academica-nivel-plataforma-plan.js — CSV de usuarios académicos
 * ordenados por NIVEL (orden pedagógico) › PLATAFORMA › TIPO DE PLAN › del más
 * antiguo al más nuevo.
 *
 * De dónde sale cada dato:
 *   - nivel / step / plataforma / contrato  → ACADEMICA
 *   - plan (Contado | Credito | Colaborador) → PEOPLE.plan (ACADEMICA no lo tiene)
 *   - antigüedad → COALESCE(PEOPLE.inicioContrato, PEOPLE.fechaContrato,
 *                           ACADEMICA._createdDate)   (misma cascada del sistema)
 *
 * El JOIN a PEOPLE prefiere BENEFICIARIO cuando el numeroId está duplicado
 * (titular que también es beneficiario), igual que el resto de la plataforma.
 * Excluye contratos de prueba (PRB-).
 *
 * Solo LECTURA. USO:
 *   node scripts/export-academica-nivel-plataforma-plan.js [--activos] [--out=ruta.csv]
 *     --activos   solo estudiantes activos (estadoInactivo IS NOT TRUE)
 *     --out=      ruta del CSV (default: docs/academica-nivel-plataforma-plan.csv)
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const SOLO_ACTIVOS = process.argv.includes('--activos');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = outArg ? outArg.slice(6) : path.join('docs', 'academica-nivel-plataforma-plan.csv');

const SQL = `
  SELECT
    a."nivel",
    a."step",
    a."plataforma",
    COALESCE(NULLIF(TRIM(p."plan"), ''), 'Sin plan')            AS "plan",
    fin."numeroCuotas"                                          AS "cuotas",
    -- Plan INFERIDO para los registros sin PEOPLE.plan. Misma regla que el
    -- backfill historico: >1 cuota = Credito, 1 = Contado (pago unico).
    -- 0 cuotas, sin FINANCIEROS o valores absurdos quedan sin resolver.
    CASE
      WHEN NULLIF(TRIM(p."plan"), '') IS NOT NULL THEN ''
      WHEN fin."numeroCuotas" IS NULL THEN 'sin FINANCIEROS'
      WHEN fin."numeroCuotas"::numeric > 60 THEN 'revisar (dato sucio)'
      WHEN fin."numeroCuotas"::numeric > 1 THEN 'Credito (inferido)'
      WHEN fin."numeroCuotas"::numeric = 1 THEN 'Contado (inferido)'
      ELSE 'indeterminado'
    END                                                         AS "planInferido",
    COALESCE(p."inicioContrato", p."fechaContrato", a."_createdDate")::date AS "fechaContrato",
    a."primerNombre",
    a."primerApellido",
    a."numeroId",
    a."contrato",
    a."email",
    a."celular",
    CASE WHEN a."estadoInactivo" IS TRUE THEN 'Inactivo' ELSE 'Activo' END AS "estado"
  FROM "ACADEMICA" a
  -- Un solo PEOPLE por numeroId, prefiriendo BENEFICIARIO ante duplicados.
  LEFT JOIN LATERAL (
    SELECT pp."plan", pp."inicioContrato", pp."fechaContrato"
      FROM "PEOPLE" pp
     WHERE pp."numeroId" = a."numeroId"
     ORDER BY CASE WHEN pp."tipoUsuario" = 'BENEFICIARIO' THEN 0 ELSE 1 END,
              pp."_createdDate" DESC NULLS LAST
     LIMIT 1
  ) p ON TRUE
  -- FINANCIEROS es del CONTRATO (no de la persona): match por numero de contrato.
  LEFT JOIN LATERAL (
    SELECT ff."numeroCuotas"
      FROM "FINANCIEROS" ff
     WHERE ff."contrato" = a."contrato"
     ORDER BY ff."_createdDate" DESC NULLS LAST
     LIMIT 1
  ) fin ON TRUE
  WHERE COALESCE(a."contrato", '') NOT LIKE 'PRB-%'
    ${SOLO_ACTIVOS ? 'AND a."estadoInactivo" IS NOT TRUE' : ''}
  ORDER BY
    -- Orden pedagógico real (NIVELES.orden), no alfabético. Los niveles que no
    -- estén en el catálogo van al final.
    COALESCE((SELECT MIN(n."orden") FROM "NIVELES" n WHERE n."code" = a."nivel"), 999),
    a."nivel",
    a."plataforma" NULLS LAST,
    "plan",
    COALESCE(p."inicioContrato", p."fechaContrato", a."_createdDate") ASC NULLS LAST
`;

/** Escapa un valor para CSV (comillas dobles, separador ; y saltos de línea). */
const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();

  const { rows } = await c.query(SQL);

  const COLS = [
    ['nivel', 'Nivel'], ['step', 'Step'], ['plataforma', 'Plataforma'], ['plan', 'Tipo Plan'],
    ['cuotas', 'Cuotas'], ['planInferido', 'Plan (inferido)'], ['fechaContrato', 'Fecha Contrato'], ['primerNombre', 'Nombre'], ['primerApellido', 'Apellido'],
    ['numeroId', 'Numero ID'], ['contrato', 'Contrato'], ['email', 'Email'],
    ['celular', 'Celular'], ['estado', 'Estado'],
  ];

  // BOM + ';' para que Excel en español lo abra en columnas sin importar nada.
  const csv = '﻿' +
    COLS.map(([, h]) => h).join(';') + '\r\n' +
    rows.map((r) => COLS.map(([k]) => cell(r[k])).join(';')).join('\r\n') + '\r\n';

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, csv, 'utf8');

  // ── Resumen en consola ──
  console.log('\n===== ACADEMICA por nivel / plataforma / plan =====');
  console.log('Filtro: ' + (SOLO_ACTIVOS ? 'solo ACTIVOS' : 'todos (activos + inactivos)') + ' · excluye PRB-');
  console.log('Filas: ' + rows.length);

  const cuenta = (campo) => {
    const m = new Map();
    for (const r of rows) m.set(r[campo] || '—', (m.get(r[campo] || '—') || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  for (const campo of ['plan', 'planInferido', 'plataforma', 'estado']) {
    console.log('\nPor ' + campo + ':');
    for (const [k, n] of cuenta(campo)) console.log('  ' + String(k).padEnd(16) + n);
  }
  console.log('\nPor nivel (orden pedagógico):');
  const vistos = new Set();
  for (const r of rows) {
    if (vistos.has(r.nivel)) continue;
    vistos.add(r.nivel);
    console.log('  ' + String(r.nivel || '—').padEnd(10) + rows.filter((x) => x.nivel === r.nivel).length);
  }

  console.log('\n✔ CSV: ' + OUT + '\n');
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
