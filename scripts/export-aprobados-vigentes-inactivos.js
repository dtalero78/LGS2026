/**
 * Exporta a CSV los registros INCONSISTENTES:
 *   aprobacion='Aprobado' AND finalContrato > hoy AND estadoInactivo=true
 *
 * Estos casos son raros: están aprobados y con contrato vigente, pero
 * marcados como inactivos. Posibles causas:
 *   - Bloqueo administrativo manual (suspendida)
 *   - Toggle de estado desde /person/[id]
 *   - Sincronización rota de OnHold antiguo
 *   - Datos legacy de Wix
 *
 * El CSV incluye campos para diagnóstico.
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
        p."tipoUsuario"       AS tipoUsuario,
        p."contrato"          AS contrato,
        p."plataforma"        AS plataforma,
        p."estado"            AS estado,
        p."aprobacion"        AS aprobacion,
        p."estadoInactivo"    AS estadoInactivo,
        TO_CHAR(p."fechaContrato", 'YYYY-MM-DD') AS fechaContrato,
        TO_CHAR(p."finalContrato", 'YYYY-MM-DD') AS finalContrato,
        p."vigencia"          AS vigencia,
        COALESCE(p."onHoldCount", 0)    AS onHoldCount,
        TO_CHAR(p."fechaOnHold", 'YYYY-MM-DD')    AS fechaOnHold,
        TO_CHAR(p."fechaFinOnHold", 'YYYY-MM-DD') AS fechaFinOnHold,
        COALESCE(p."extensionCount", 0) AS extensionCount,
        p."email"             AS email,
        p."celular"           AS celular,
        TO_CHAR(p."_updatedDate", 'YYYY-MM-DD HH24:MI') AS updatedDate,
        -- Diagnóstico: ¿tiene login bloqueado?
        u."activo"            AS usuariosRolesActivo,
        -- Diagnóstico: ¿qué dice ACADEMICA?
        a."estadoInactivo"    AS academicaInactivo
      FROM "PEOPLE" p
      LEFT JOIN "USUARIOS_ROLES" u ON LOWER(u."email") = LOWER(p."email")
      LEFT JOIN "ACADEMICA" a       ON a."numeroId" = p."numeroId"
      WHERE p."aprobacion" = 'Aprobado'
        AND p."finalContrato" IS NOT NULL
        AND p."finalContrato" > CURRENT_DATE
        AND p."estadoInactivo" = true
        AND p."estado" IS NULL
      ORDER BY p."primerApellido" NULLS LAST, p."primerNombre" NULLS LAST
    `);

    console.log(`Registros inconsistentes: ${r.rowCount}`);

    const headers = [
      'people_id', 'numeroId', 'nombre', 'tipoUsuario', 'contrato', 'plataforma',
      'estado', 'aprobacion', 'estadoInactivo',
      'fechaContrato', 'finalContrato', 'vigencia',
      'onHoldCount', 'fechaOnHold', 'fechaFinOnHold',
      'extensionCount',
      'email', 'celular', 'updatedDate',
      'usuariosRolesActivo', 'academicaInactivo',
    ];
    const lines = [headers.join(';')];
    for (const row of r.rows) {
      lines.push(headers.map(h => csvEscape(row[h])).join(';'));
    }
    const filepath = path.join(process.cwd(), 'aprobados-vigentes-inconsistentes.csv');
    fs.writeFileSync(filepath, '﻿' + lines.join('\n'), 'utf8');
    console.log(`✓ aprobados-vigentes-inconsistentes.csv (${r.rowCount} filas)`);

    // Distribuciones útiles
    const porRol = r.rows.reduce((acc, row) => {
      const k = row.tipoUsuario || 'NULL';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    console.log('\nPor tipoUsuario:', porRol);

    const conOnHold = r.rows.filter(row => row.onHoldCount > 0).length;
    const conExt    = r.rows.filter(row => row.extensionCount > 0).length;
    const loginBloqueado = r.rows.filter(row => row.usuariosRolesActivo === false).length;
    const academicaInactiva = r.rows.filter(row => row.academicaInactivo === true).length;
    console.log(`\nDiagnóstico cruzado:`);
    console.log(`  Tienen onHoldCount>0:      ${conOnHold}`);
    console.log(`  Tienen extensionCount>0:   ${conExt}`);
    console.log(`  USUARIOS_ROLES.activo=false: ${loginBloqueado}`);
    console.log(`  ACADEMICA.estadoInactivo=true: ${academicaInactiva}`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
