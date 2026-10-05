// Fix puntual — contrato 01-10738-25 (Katherine Escobar, doc 191937546), autorizado el 2026-10-05.
// El contrato (plan 12 meses, inicio 2025-11-28) se re-aprobó desde "Contrato nulo", pero su
// finalContrato había quedado en 2025-12-18 (día en que se creó el contrato 01-10881-25, plan
// de 4 meses ya FINALIZADO). Con esa fecha el cron expire-contracts lo finaliza de nuevo y el
// login la rechaza por contrato vencido.
// Corrige finalContrato → 2026-11-28 (12 meses desde el inicio) en titular + beneficiario,
// deja traza en extensionHistory, asegura ACTIVA/activo en PEOPLE, ACADEMICA y USUARIOS_ROLES,
// y quita el espacio sobrante del apellido. NO toca 01-10881-25.
// Dry-run por defecto; --apply para escribir. Todo en una transacción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');
const CONTRATO = '01-10738-25';
const NUEVA = '2026-11-28';
const MOTIVO = 'Corrección al re-aprobar el contrato (2026-10-05): finalContrato había quedado en 2025-12-18 al crearse el contrato 01-10881-25; se restablece a 12 meses desde el inicio (2025-11-28).';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');
    const rows = (await c.query(
      `SELECT "_id","tipoUsuario","numeroId","email","aprobacion","finalContrato"::text fc,"extensionCount","extensionHistory"
         FROM "PEOPLE" WHERE "contrato" = $1 FOR UPDATE`, [CONTRATO])).rows;
    if (!rows.length) throw new Error('Contrato no encontrado');
    if (rows.some(r => r.aprobacion !== 'Aprobado')) throw new Error('El contrato no está Aprobado: abortado');

    for (const r of rows) {
      const hist = Array.isArray(r.extensionHistory) ? r.extensionHistory : [];
      const dias = Math.round((Date.parse(NUEVA) - Date.parse(r.fc)) / 86400000);
      hist.push({ numero: hist.length + 1, fechaEjecucion: new Date().toISOString(), vigenciaAnterior: r.fc, vigenciaNueva: NUEVA,
        diasExtendidos: dias, motivo: MOTIVO, tipo: 'CORRECCION', ejecutadoPor: 'script:fix-01-10738-25-final-contrato' });
      await c.query(
        `UPDATE "PEOPLE" SET "finalContrato" = $1::date, "estado" = 'ACTIVA', "estadoInactivo" = false,
                "primerApellido" = TRIM("primerApellido"), "extensionCount" = COALESCE("extensionCount",0) + 1,
                "extensionHistory" = $2::jsonb, "_updatedDate" = NOW()
          WHERE "_id" = $3`, [NUEVA, JSON.stringify(hist), r._id]);
    }
    const nid = rows[0].numeroId, email = rows[0].email;
    const ac = await c.query(
      `UPDATE "ACADEMICA" SET "estadoInactivo" = false, "_updatedDate" = NOW()
        WHERE "contrato" = $1 AND UPPER(REGEXP_REPLACE(COALESCE("numeroId",''), '[.[:space:]_-]', '', 'g')) = UPPER(REGEXP_REPLACE($2, '[.[:space:]_-]', '', 'g'))
        RETURNING "_id","nivel","step"`, [CONTRATO, nid]);
    const ur = await c.query(
      `UPDATE "USUARIOS_ROLES" SET "activo" = true WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) AND UPPER("rol") = 'ESTUDIANTE'
        RETURNING "_id","email","activo","contrato"`, [email]);

    console.log('PEOPLE (dentro de la transacción):');
    console.table((await c.query(
      `SELECT "tipoUsuario","primerApellido","aprobacion","estado","estadoInactivo","fechaContrato"::text,"finalContrato"::text,"extensionCount"
         FROM "PEOPLE" WHERE "contrato" = $1`, [CONTRATO])).rows);
    console.log('ACADEMICA:'); console.table(ac.rows);
    console.log('USUARIOS_ROLES:'); console.table(ur.rows);

    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO (COMMIT).'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK. Use --apply para aplicar.'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
