/**
 * Diagnóstico masivo: detectar estudiantes "pegados".
 *
 * Aplica la misma lógica que `isCurrentStepComplete()` en student.service.ts
 * pero sobre TODOS los estudiantes activos en niveles normales (BN1..F3),
 * sin modificar nada en BD.
 *
 * Definición de "pegado":
 *   stepRealCalculado > stepActualEnAcademica
 *   es decir: el estudiante completó steps que el sistema no le acreditó.
 *
 * Para cada estudiante calcula:
 *   - stepActual: ACADEMICA.step actual (ej. 14)
 *   - stepReal:   primer step incompleto en orden cronológico del nivel
 *                 (si todos completos → siguiente nivel/step)
 *   - desfase:    stepReal - stepActual (cuántos steps de avance perdió)
 *
 * Reglas aplicadas (idénticas a student.service.ts):
 *   - STEP_OVERRIDES tiene prioridad absoluta (isCompleted=true/false)
 *   - Jump (Step %5==0): algún booking con asistio+participacion+!noAprobo+!cancelo
 *   - Normal: ≥2 SESSION exitosas (COMPLEMENTARIA cuenta como SESSION)
 *             + ≥1 TRAINING club exitoso del step
 *             + ningún booking con noAprobo=true
 *   - Cancelados NO cuentan (excluidos)
 *
 * Niveles excluidos del diagnóstico:
 *   WELCOME, ESS, DONE, MASTER, IELTS, IELS, B2FIRST, TOEFL
 *   (cada uno tiene reglas propias en su servicio)
 *
 * Output:
 *   - Summary por nivel + magnitud del desfase
 *   - CSV con detalle de cada pegado
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const EXCLUDED_NIVELES = new Set([
  'WELCOME', 'ESS', 'DONE', 'MASTER', 'IELTS', 'IELS', 'B2FIRST', 'TOEFL',
]);

// Orden secuencial de niveles normales y su rango de steps
const NIVELES_ORDEN = [
  { code: 'BN1', steps: [1, 2, 3, 4, 5] },
  { code: 'BN2', steps: [6, 7, 8, 9, 10] },
  { code: 'BN3', steps: [11, 12, 13, 14, 15] },
  { code: 'P1',  steps: [16, 17, 18, 19, 20] },
  { code: 'P2',  steps: [21, 22, 23, 24, 25] },
  { code: 'P3',  steps: [26, 27, 28, 29, 30] },
  { code: 'F1',  steps: [31, 32, 33, 34, 35] },
  { code: 'F2',  steps: [36, 37, 38, 39, 40] },
  { code: 'F3',  steps: [41, 42, 43, 44, 45] },
];

function extractStepNum(stepName) {
  if (!stepName) return null;
  const m = String(stepName).match(/Step\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function isExitosa(b) {
  return b.asistio === true || b.asistencia === true;
}

function aproboElJump(b) {
  return isExitosa(b) && b.participacion === true && b.noAprobo !== true && b.cancelo !== true;
}

function getClassType(b) {
  if (b.tipo === 'SESSION' || b.tipo === 'COMPLEMENTARIA') return 'SESSION';
  if (b.tipo === 'CLUB') return 'CLUB';
  if (!b.tipo && b.step) {
    if (/^TRAINING\s*-/i.test(b.step)) return 'CLUB';
    if (/^Step\s+\d+$/i.test(b.step)) return 'SESSION';
  }
  return 'OTHER';
}

/**
 * Evalúa si un step dado está completo según los bookings disponibles.
 * Aplica overrides primero, luego la regla del tipo (Jump vs normal).
 */
function isStepComplete(stepNum, bookings, overrides) {
  // Override tiene prioridad absoluta
  const ov = overrides.get(`Step ${stepNum}`);
  if (ov !== undefined) return ov === true;

  const clasesDelStep = bookings.filter(b => {
    if (b.cancelo === true) return false;
    return extractStepNum(b.step) === stepNum;
  });

  if (clasesDelStep.length === 0) return false;

  const esJump = stepNum > 0 && stepNum % 5 === 0;

  if (esJump) {
    return clasesDelStep.some(b => aproboElJump(b));
  }

  const tieneNoAprobo = clasesDelStep.some(b => b.noAprobo === true);
  if (tieneNoAprobo) return false;

  const sesionesExitosas = clasesDelStep.filter(b =>
    getClassType(b) === 'SESSION' && isExitosa(b)
  ).length;

  const trainingClubsExitosos = clasesDelStep.filter(b => {
    if (getClassType(b) !== 'CLUB') return false;
    const name = b.step || b.nombreEvento || '';
    return /^TRAINING\s*-/i.test(name) && isExitosa(b);
  }).length;

  return sesionesExitosas >= 2 && trainingClubsExitosos >= 1;
}

/**
 * Dado un estudiante con su nivel actual y sus bookings/overrides,
 * calcula el step "real" siguiendo la regla estricta:
 *   primer step incompleto en orden = step actual.
 *   si todos completos → +1 (al siguiente step/nivel).
 */
function computeStepReal(nivelActual, bookings, overrides) {
  const nivelInfo = NIVELES_ORDEN.find(n => n.code === nivelActual);
  if (!nivelInfo) return null;

  for (const stepNum of nivelInfo.steps) {
    if (!isStepComplete(stepNum, bookings, overrides)) {
      return stepNum;
    }
  }
  // Todos los steps del nivel completos → primer step del siguiente nivel
  const idx = NIVELES_ORDEN.findIndex(n => n.code === nivelActual);
  const next = NIVELES_ORDEN[idx + 1];
  if (!next) return nivelInfo.steps[nivelInfo.steps.length - 1] + 1; // F3 → 46 (MASTER)
  return next.steps[0];
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  try {
    console.log('▶ Cargando estudiantes activos en niveles normales...');
    const studentsRes = await pool.query(`
      SELECT a."_id" AS "academicaId",
             a."numeroId",
             a."primerNombre",
             a."primerApellido",
             a."nivel",
             a."step",
             a."estadoInactivo"
      FROM "ACADEMICA" a
      WHERE a."nivel" = ANY($1::text[])
        AND (a."estadoInactivo" IS NULL OR a."estadoInactivo" = false)
        AND a."step" IS NOT NULL
    `, [NIVELES_ORDEN.map(n => n.code)]);

    const students = studentsRes.rows;
    console.log(`  → ${students.length} estudiantes a evaluar.\n`);

    // Pre-cargar bookings por estudiante (en bulk)
    console.log('▶ Cargando bookings (puede tardar)...');
    const bookingsRes = await pool.query(`
      SELECT COALESCE(b."studentId", b."idEstudiante") AS sid,
             COALESCE(c."step", b."step") AS step,
             COALESCE(c."nivel", b."nivel") AS nivel,
             COALESCE(c."tipo", b."tipoEvento") AS tipo,
             b."nombreEvento",
             b."asistio",
             b."asistencia",
             b."participacion",
             b."noAprobo",
             b."cancelo"
      FROM "ACADEMICA_BOOKINGS" b
      LEFT JOIN "CALENDARIO" c ON c."_id" = COALESCE(b."eventoId", b."idEvento")
      WHERE COALESCE(b."studentId", b."idEstudiante") = ANY($1::text[])
    `, [students.map(s => s.academicaId)]);

    const bookingsBySid = new Map();
    for (const b of bookingsRes.rows) {
      if (!bookingsBySid.has(b.sid)) bookingsBySid.set(b.sid, []);
      bookingsBySid.get(b.sid).push(b);
    }
    console.log(`  → ${bookingsRes.rows.length} bookings cargados.\n`);

    console.log('▶ Cargando step overrides...');
    const overridesRes = await pool.query(`
      SELECT "studentId", "step", "isCompleted"
      FROM "STEP_OVERRIDES"
      WHERE "studentId" = ANY($1::text[])
    `, [students.map(s => s.academicaId)]);

    const overridesBySid = new Map();
    for (const o of overridesRes.rows) {
      if (!overridesBySid.has(o.studentId)) overridesBySid.set(o.studentId, new Map());
      overridesBySid.get(o.studentId).set(o.step, o.isCompleted);
    }
    console.log(`  → ${overridesRes.rows.length} overrides cargados.\n`);

    // Evaluar cada estudiante
    console.log('▶ Evaluando...');
    const pegados = [];
    let avanzados = 0;        // stepReal < stepActual (raro, indica que perdió cobertura)
    let ok = 0;
    let sinBookings = 0;

    for (const s of students) {
      const bookings = bookingsBySid.get(s.academicaId) || [];
      const overrides = overridesBySid.get(s.academicaId) || new Map();
      const stepActual = extractStepNum(s.step);
      if (stepActual === null) continue;

      const stepReal = computeStepReal(s.nivel, bookings, overrides);
      if (stepReal === null) continue;

      if (bookings.length === 0) { sinBookings++; continue; }

      if (stepReal > stepActual) {
        pegados.push({
          academicaId: s.academicaId,
          numeroId: s.numeroId,
          nombre: `${s.primerNombre || ''} ${s.primerApellido || ''}`.trim(),
          nivel: s.nivel,
          stepActual,
          stepReal,
          desfase: stepReal - stepActual,
          totalBookings: bookings.length,
          tieneOverrides: overrides.size > 0,
        });
      } else if (stepReal < stepActual) {
        avanzados++;
      } else {
        ok++;
      }
    }

    // ───── REPORTE ─────
    console.log('\n========= RESUMEN =========');
    console.log(`Total estudiantes evaluados:           ${students.length}`);
    console.log(`  ✓ OK (stepReal === stepActual):      ${ok}`);
    console.log(`  ⚠ PEGADOS (stepReal > stepActual):   ${pegados.length}`);
    console.log(`  ↑ Avanzados (stepReal < stepActual): ${avanzados}  ← admin los movió manualmente`);
    console.log(`  − Sin bookings (no evaluable):       ${sinBookings}`);

    if (pegados.length === 0) {
      console.log('\n✅ No hay estudiantes pegados.');
      return;
    }

    // Desglose por desfase
    console.log('\n========= DESFASE (cuántos steps perdió) =========');
    const porDesfase = pegados.reduce((acc, p) => {
      acc[p.desfase] = (acc[p.desfase] || 0) + 1;
      return acc;
    }, {});
    for (const [d, n] of Object.entries(porDesfase).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      console.log(`  +${d} step${d === '1' ? '' : 's'}: ${n} estudiantes`);
    }

    // Desglose por nivel
    console.log('\n========= POR NIVEL =========');
    const porNivel = pegados.reduce((acc, p) => {
      acc[p.nivel] = (acc[p.nivel] || 0) + 1;
      return acc;
    }, {});
    for (const n of NIVELES_ORDEN.map(x => x.code)) {
      if (porNivel[n]) console.log(`  ${n}: ${porNivel[n]}`);
    }

    // Top 20 con mayor desfase
    console.log('\n========= TOP 20 (mayor desfase) =========');
    const top = [...pegados].sort((a, b) => b.desfase - a.desfase).slice(0, 20);
    console.table(top.map(p => ({
      numeroId: p.numeroId,
      nombre: p.nombre,
      nivel: p.nivel,
      stepActual: p.stepActual,
      stepReal: p.stepReal,
      desfase: p.desfase,
    })));

    // CSV
    const csvPath = path.join(process.cwd(), 'estudiantes-pegados.csv');
    const header = 'numeroId,nombre,nivel,stepActual,stepReal,desfase,totalBookings,tieneOverrides,academicaId\n';
    const rows = pegados
      .sort((a, b) => b.desfase - a.desfase || a.nivel.localeCompare(b.nivel))
      .map(p => [
        p.numeroId,
        `"${(p.nombre || '').replace(/"/g, '""')}"`,
        p.nivel,
        p.stepActual,
        p.stepReal,
        p.desfase,
        p.totalBookings,
        p.tieneOverrides,
        p.academicaId,
      ].join(','))
      .join('\n');
    fs.writeFileSync(csvPath, '﻿' + header + rows);
    console.log(`\n✅ CSV escrito en: ${csvPath}`);
    console.log(`   ${pegados.length} filas`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
