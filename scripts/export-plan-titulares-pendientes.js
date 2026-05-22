/**
 * Exporta a CSV los TITULARES con plan NULL/vacío/'0' que no se pudieron
 * derivar automáticamente. Incluye datos del titular y del registro
 * FINANCIEROS asociado (si existe) para facilitar la curación manual.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const r = await pool.query(`
      SELECT
        p."_id"               AS people_id,
        p."numeroId"          AS numeroId,
        TRIM(p."primerNombre" || ' ' || COALESCE(p."primerApellido", '')) AS nombre,
        p."contrato"          AS contrato,
        p."plataforma"        AS plataforma,
        p."plan"              AS plan_actual,
        p."estado"            AS estado,
        p."aprobacion"        AS aprobacion,
        p."estadoInactivo"    AS estadoInactivo,
        TO_CHAR(p."fechaContrato", 'YYYY-MM-DD') AS fechaContrato,
        TO_CHAR(p."finalContrato", 'YYYY-MM-DD') AS finalContrato,
        f."numeroCuotas"      AS financieros_numeroCuotas,
        f."totalPlan"         AS financieros_totalPlan,
        f."valorCuota"        AS financieros_valorCuota,
        p."email"             AS email,
        p."celular"           AS celular,
        CASE
          WHEN f."_id" IS NULL THEN 'sin_financieros'
          WHEN f."numeroCuotas" IS NULL THEN 'numeroCuotas_NULL'
          WHEN CAST(f."numeroCuotas" AS INTEGER) = 0 THEN 'numeroCuotas_0'
          ELSE 'otro'
        END AS motivo_pendiente
      FROM "PEOPLE" p
      LEFT JOIN "FINANCIEROS" f ON f."contrato" = p."contrato"
      WHERE p."tipoUsuario" = 'TITULAR'
        AND (p."plan" IS NULL OR p."plan" = '' OR p."plan" = '0')
      ORDER BY p."primerApellido" NULLS LAST, p."primerNombre" NULLS LAST
    `);

    console.log(`Titulares pendientes: ${r.rowCount}`);

    const headers = [
      'people_id', 'numeroId', 'nombre', 'contrato', 'plataforma', 'plan_actual',
      'estado', 'aprobacion', 'estadoInactivo',
      'fechaContrato', 'finalContrato',
      'financieros_numeroCuotas', 'financieros_totalPlan', 'financieros_valorCuota',
      'email', 'celular', 'motivo_pendiente',
    ];
    const lines = [headers.join(';')];
    for (const row of r.rows) {
      lines.push(headers.map(h => csvEscape(row[h])).join(';'));
    }
    const filepath = path.join(process.cwd(), 'plan-titulares-pendientes.csv');
    fs.writeFileSync(filepath, '﻿' + lines.join('\n'), 'utf8');
    console.log(`✓ plan-titulares-pendientes.csv (${r.rowCount} filas)`);

    // Distribución por motivo
    const dist = r.rows.reduce((acc, row) => {
      acc[row.motivo_pendiente] = (acc[row.motivo_pendiente] || 0) + 1;
      return acc;
    }, {});
    console.log('\nDistribución por motivo:');
    Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(25)} ${v}`);
    });
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
