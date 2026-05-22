/**
 * Backfill asignación de Adiela Londoño Cuellar como gestorRecaudo + creación
 * de cuota #0 en PAGOS_TITULARES + actualización de FINANCIEROS desde CSV.
 *
 * Lee:  C:\\Users\\tddir\\Downloads\\asignacionAdiela.csv  (separador ;)
 * Modo: dry-run por defecto. Use --apply para escribir.
 *
 * Diferencias con el CSV de Angela:
 *  - Fechas en DD/MM/YYYY (no serial Excel).
 *  - No trae columna SALDO → calcular = totalPrograma - pagoInscripcion.
 *  - totalPrograma (en vez de totalPlan), valorCuota (en vez de ValorCuota).
 *  - Algunos montos vienen con $ y . como separador de miles ($5.511.500).
 *
 * Reglas (mismas que Angela):
 *  - Match por numeroId + contrato (TRIM ambos, sin espacios internos). Ignorar email.
 *  - NO actualizar fechaContrato en PEOPLE.
 *  - Si el plan del CSV difiere del actual en PEOPLE/FINANCIEROS, NO actualizar plan.
 *  - Crear cuota #0 en PAGOS_TITULARES si no existe.
 *  - Si cuota #0 ya existe, solo actualizar gestorRecaudo.
 *  - validadoPor / createdBy = email del usuario actual (plataformalgsdigital@gmail.com).
 *  - gestorRecaudo (PEOPLE + PAGOS_TITULARES) = adiela0578@gmail.com.
 *  - fechaVencimiento cuota #0 = fechaPago + 1 mes.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');
const CSV_PATH = 'C:\\Users\\tddir\\Downloads\\asignacionAdiela.csv';

// El usuario pidió usar el _id de USUARIOS_ROLES en gestorRecaudo (no el email).
const GESTOR_RECAUDO = 'dcce6de6-a29b-4073-8252-18524024569b'; // Adiela Londoño Cuellar
const USUARIO_ACTUAL_EMAIL = 'plataformalgsdigital@gmail.com';

// DD/MM/YYYY (o D/M/YYYY) → ISO YYYY-MM-DD
function ddmmyyyyToISO(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const isoMonth = String(mo).padStart(2, '0');
  const isoDay = String(d).padStart(2, '0');
  return `${y}-${isoMonth}-${isoDay}`;
}

function addOneMonth(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const targetMonth = m === 12 ? 1 : m + 1;
  const targetYear = m === 12 ? y + 1 : y;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "$5.511.500" / "4.883.600" / "240000" → 5511500 / 4883600 / 240000
function parseMoney(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace(/[\$\s]/g, '');
  // Si tiene puntos pero no coma, son separadores de miles → quitar todos
  if (cleaned.includes('.') && !cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, ''));
  }
  // Si tiene coma decimal, reemplazar por punto
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  return Number(cleaned);
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines.shift().split(';').map(h => h.trim());
  return lines.map((line, idx) => {
    const cols = line.split(';');
    const row = { _line: idx + 2 };
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = (cols[i] || '').trim();
    }
    return row;
  });
}

function genPaymentId() {
  return `pag_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvContent);

  console.log(`\n=== Backfill asignación Adiela (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`Filas: ${rows.length}`);
  console.log(`gestorRecaudo destino: ${GESTOR_RECAUDO}`);
  console.log(`validadoPor/createdBy: ${USUARIO_ACTUAL_EMAIL}\n`);

  const stats = {
    matched: 0,
    notFound: 0,
    peopleUpdated: 0,
    peoplePlanSkipped: 0,
    financierosUpdated: 0,
    financierosInserted: 0,
    financierosPlanSkipped: 0,
    pagosCreated: 0,
    pagosUpdatedGestor: 0,
    errors: [],
    badMoney: [],
    badDate: [],
  };

  const csvLog = [];

  for (const row of rows) {
    const contrato = (row.contrato || '').replace(/\s+/g, '');
    const numeroId = (row.numeroid || '').replace(/\s+/g, '');
    const planCSV = (row.plan || '').trim();
    const numeroCuotasCSV = Number(row.numeroCuotas);
    const pagoInscripcionCSV = parseMoney(row.pagoInscripcion);
    const valorCuotaCSV = parseMoney(row.valorCuota);
    const totalProgramaCSV = parseMoney(row.totalPrograma);
    // saldo = totalPrograma - pagoInscripcion
    const saldoCSV = (Number.isFinite(totalProgramaCSV) && Number.isFinite(pagoInscripcionCSV))
      ? totalProgramaCSV - pagoInscripcionCSV
      : NaN;
    const fechaPagoISO = ddmmyyyyToISO(row.fechaPago);
    const fechaVencimientoISO = fechaPagoISO ? addOneMonth(fechaPagoISO) : null;

    const logEntry = {
      line: row._line,
      item: row.ITEM,
      numeroId,
      contrato,
      planCSV,
      fechaPagoISO: fechaPagoISO || '',
      saldoCalc: Number.isFinite(saldoCSV) ? saldoCSV : '',
      status: '',
      detail: '',
    };

    if (!fechaPagoISO) stats.badDate.push(`#${row.ITEM} fechaPago="${row.fechaPago}"`);
    if (!Number.isFinite(totalProgramaCSV) || !Number.isFinite(pagoInscripcionCSV)) {
      stats.badMoney.push(`#${row.ITEM} totalPrograma="${row.totalPrograma}" pagoInscripcion="${row.pagoInscripcion}"`);
    }

    const peopleRes = await pool.query(`
      SELECT "_id", "numeroId", "primerNombre", "primerApellido", "email",
             "tipoUsuario", "contrato", "plan", "gestorRecaudo", "plataforma"
      FROM "PEOPLE"
      WHERE REPLACE(LOWER(TRIM("contrato")), ' ', '') = LOWER($1)
        AND "tipoUsuario" = 'TITULAR'
    `, [contrato.toLowerCase()]);

    let titular = peopleRes.rows.find(p =>
      (p.numeroId || '').replace(/\s+/g, '') === numeroId
    );
    if (!titular && peopleRes.rows.length === 1) {
      titular = peopleRes.rows[0];
    }

    if (!titular) {
      stats.notFound++;
      logEntry.status = 'NOT_FOUND';
      logEntry.detail = `contrato="${contrato}" numeroId="${numeroId}" — ${peopleRes.rowCount} TITULAR(es) encontrados`;
      csvLog.push(logEntry);
      continue;
    }

    stats.matched++;
    const titularId = titular._id;
    const planActual = (titular.plan || '').trim();
    const planMatchea = !planActual || planActual === planCSV;

    // PEOPLE
    const peopleUpdates = [];
    const peopleParams = [];
    let pIdx = 1;
    if ((titular.gestorRecaudo || '') !== GESTOR_RECAUDO) {
      peopleUpdates.push(`"gestorRecaudo" = $${pIdx++}`);
      peopleParams.push(GESTOR_RECAUDO);
    }
    if (planMatchea && !planActual) {
      peopleUpdates.push(`"plan" = $${pIdx++}`);
      peopleParams.push(planCSV);
    }
    if (peopleUpdates.length > 0) {
      peopleParams.push(titularId);
      if (APPLY) {
        await pool.query(
          `UPDATE "PEOPLE" SET ${peopleUpdates.join(', ')}, "_updatedDate" = NOW() WHERE "_id" = $${pIdx}`,
          peopleParams
        );
      }
      stats.peopleUpdated++;
    }
    if (!planMatchea) stats.peoplePlanSkipped++;

    // FINANCIEROS
    const finRes = await pool.query(`
      SELECT "_id", "plan", "numeroCuotas", "pagoInscripcion", "valorCuota", "totalPlan", "saldo"
      FROM "FINANCIEROS"
      WHERE "titularId" = $1 OR REPLACE(LOWER(TRIM("contrato")), ' ', '') = LOWER($2)
      LIMIT 1
    `, [titularId, contrato.toLowerCase()]);
    const fin = finRes.rows[0] || null;

    const finPlanActual = fin ? (fin.plan || '').trim() : '';
    const finPlanMatchea = !finPlanActual || finPlanActual === planCSV;

    if (fin) {
      const finUpdates = [];
      const finParams = [];
      let fIdx = 1;
      if (finPlanMatchea && !finPlanActual) {
        finUpdates.push(`"plan" = $${fIdx++}`);
        finParams.push(planCSV);
      }
      finUpdates.push(`"numeroCuotas" = $${fIdx++}`); finParams.push(numeroCuotasCSV);
      finUpdates.push(`"pagoInscripcion" = $${fIdx++}`); finParams.push(String(pagoInscripcionCSV));
      finUpdates.push(`"valorCuota" = $${fIdx++}`); finParams.push(String(valorCuotaCSV));
      finUpdates.push(`"totalPlan" = $${fIdx++}`); finParams.push(String(totalProgramaCSV));
      finUpdates.push(`"saldo" = $${fIdx++}`); finParams.push(String(saldoCSV));
      finParams.push(fin._id);
      if (APPLY) {
        await pool.query(
          `UPDATE "FINANCIEROS" SET ${finUpdates.join(', ')}, "_updatedDate" = NOW() WHERE "_id" = $${fIdx}`,
          finParams
        );
      }
      stats.financierosUpdated++;
      if (!finPlanMatchea) stats.financierosPlanSkipped++;
    } else {
      const finId = `fin_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      if (APPLY) {
        await pool.query(`
          INSERT INTO "FINANCIEROS"
          ("_id", "contrato", "numeroId", "primerNombre", "primerApellido",
           "totalPlan", "valorCuota", "pagoInscripcion", "numeroCuotas",
           "cuotasPagadas", "saldo", "titularId", "plan", "origen")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'POSTGRES')
        `, [
          finId, contrato, titular.numeroId, titular.primerNombre, titular.primerApellido,
          String(totalProgramaCSV), String(valorCuotaCSV), String(pagoInscripcionCSV), numeroCuotasCSV,
          0, String(saldoCSV), titularId, planMatchea ? planCSV : null,
        ]);
      }
      stats.financierosInserted++;
    }

    // PAGOS_TITULARES cuota #0
    const pagoRes = await pool.query(`
      SELECT "_id", "gestorRecaudo"
      FROM "PAGOS_TITULARES"
      WHERE "idPeople" = $1 AND "numCuota" = 0
      LIMIT 1
    `, [titularId]);

    if (pagoRes.rowCount === 0) {
      const pagoId = genPaymentId();
      if (APPLY) {
        await pool.query(`
          INSERT INTO "PAGOS_TITULARES"
          ("_id", "idPeople", "numeroId", "gestorRecaudo", "plataforma",
           "fechaPago", "fechaVencimiento", "fechaValidacion",
           "plan", "vlrTotalProg", "numCuota", "valorCuota", "valorPagado",
           "saldo", "medioPago", "validado", "createdBy", "validadoPor",
           "inscripcion", "cuotasTotal", "tipoCartera")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13, $14, true, $15, $15, $16, $17, 'normal')
        `, [
          pagoId, titularId, titular.numeroId, GESTOR_RECAUDO, titular.plataforma,
          fechaPagoISO || new Date().toISOString().slice(0, 10), fechaVencimientoISO, fechaPagoISO,
          planCSV, String(totalProgramaCSV), String(valorCuotaCSV), String(pagoInscripcionCSV),
          String(saldoCSV), 'Transferencia',
          USUARIO_ACTUAL_EMAIL, String(pagoInscripcionCSV), numeroCuotasCSV
        ]);
      }
      stats.pagosCreated++;
      logEntry.status = 'CREATED_PAGO0';
    } else {
      const existing = pagoRes.rows[0];
      if ((existing.gestorRecaudo || '') !== GESTOR_RECAUDO) {
        if (APPLY) {
          await pool.query(
            `UPDATE "PAGOS_TITULARES" SET "gestorRecaudo" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
            [GESTOR_RECAUDO, existing._id]
          );
        }
        stats.pagosUpdatedGestor++;
        logEntry.status = 'UPDATED_GESTOR_PAGO0';
      } else {
        logEntry.status = 'NO_CHANGE_PAGO0';
      }
    }

    if (!planMatchea) {
      logEntry.detail = `plan CSV="${planCSV}" vs PEOPLE="${planActual}" → no actualizar`;
    }
    csvLog.push(logEntry);
  }

  console.log('\n=== Resultados ===');
  console.log(`  Matched:                            ${stats.matched}`);
  console.log(`  NO encontrados:                     ${stats.notFound}`);
  console.log(`  PEOPLE actualizados:                ${stats.peopleUpdated}`);
  console.log(`  PEOPLE plan saltado (≠ CSV):        ${stats.peoplePlanSkipped}`);
  console.log(`  FINANCIEROS actualizados:           ${stats.financierosUpdated}`);
  console.log(`  FINANCIEROS plan saltado (≠ CSV):   ${stats.financierosPlanSkipped}`);
  console.log(`  FINANCIEROS insertados (nuevos):    ${stats.financierosInserted}`);
  console.log(`  PAGOS cuota #0 creados:             ${stats.pagosCreated}`);
  console.log(`  PAGOS cuota #0 gestor actualizado:  ${stats.pagosUpdatedGestor}`);
  if (stats.badDate.length > 0) {
    console.log(`\n  Fechas inválidas (${stats.badDate.length}):`);
    for (const e of stats.badDate) console.log(`    ${e}`);
  }
  if (stats.badMoney.length > 0) {
    console.log(`\n  Montos inválidos (${stats.badMoney.length}):`);
    for (const e of stats.badMoney) console.log(`    ${e}`);
  }

  const outPath = path.join(process.cwd(), 'asignacion-adiela-resultado.csv');
  const csvOut = [
    'line;item;numeroId;contrato;planCSV;fechaPagoISO;saldoCalc;status;detail',
    ...csvLog.map(l => [l.line, l.item, l.numeroId, l.contrato, l.planCSV, l.fechaPagoISO, l.saldoCalc, l.status, l.detail].join(';')),
  ].join('\n');
  fs.writeFileSync(outPath, csvOut, 'utf8');
  console.log(`\nCSV de auditoría: ${outPath}`);

  if (!APPLY) {
    console.log('\n⚠️  DRY-RUN — no se escribió nada. Ejecuta con --apply para aplicar.');
  } else {
    console.log('\n✅ Cambios aplicados.');
  }

  await pool.end();
})();
