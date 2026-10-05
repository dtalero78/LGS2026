// Fix puntual — Raúl Valenzuela (doc 145255171), autorizado el 2026-10-05:
//   1. Corrige el correo con error de digitación en el contrato APROBADO 01-10397-25
//      ("rvalenzuelacuevas@hotmal.com" → "rvalenzuelacuevas@hotmail.com"), para que
//      coincida con su login (USUARIOS_ROLES) y su ficha académica.
//   2. ANULA el borrador duplicado 01-10396-25 (titular + beneficiario; sin aprobar,
//      sin firma; su pago de $90.000 es el mismo del aprobado, ambos validados por
//      la migración). Anular = estado ANULADO, estadoInactivo, aprobacion 'Contrato nulo'.
//      Queda auditado en APROBACION_AUDIT y luego se depura en Limpieza de Anulados.
// NO toca ACADEMICA, ACADEMICA_BOOKINGS ni USUARIOS_ROLES.
// Dry-run por defecto; --apply para escribir. Todo en una transacción.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const APPLY = process.argv.includes('--apply');
const APROBADO = '01-10397-25';
const BORRADOR = '01-10396-25';
const MAL = 'rvalenzuelacuevas@hotmal.com';
const BIEN = 'rvalenzuelacuevas@hotmail.com';
const MOTIVO = 'Borrador duplicado del contrato aprobado 01-10397-25 (mismo titular y beneficiario, doc 145255171). Anulado por solicitud del 2026-10-05.';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  try {
    await c.query('BEGIN');

    const mails = (await c.query(
      `SELECT "_id","tipoUsuario","email" FROM "PEOPLE" WHERE "contrato"=$1 AND LOWER(TRIM("email"))=$2 FOR UPDATE`, [APROBADO, MAL])).rows;
    console.log(`1) Correo a corregir en ${APROBADO}: ${mails.length} fila(s)`); console.table(mails);

    const borr = (await c.query(
      `SELECT "_id","tipoUsuario","aprobacion","estado","estadoInactivo","primerNombre","primerApellido",
              (COALESCE("hashConsentimiento",'')<>'') firmado
         FROM "PEOPLE" WHERE "contrato"=$1 FOR UPDATE`, [BORRADOR])).rows;
    console.log(`2) Borrador ${BORRADOR} a anular: ${borr.length} fila(s)`); console.table(borr);
    if (borr.some(r => String(r.aprobacion || '').toUpperCase() === 'APROBADO')) throw new Error('El borrador tiene filas aprobadas: abortado');
    if (borr.some(r => r.firmado)) throw new Error('El borrador está firmado: abortado');

    if (mails.length) {
      await c.query(`UPDATE "PEOPLE" SET "email"=$1, "_updatedDate"=NOW() WHERE "_id" = ANY($2::text[])`, [BIEN, mails.map(m => m._id)]);
    }
    await c.query(
      `UPDATE "PEOPLE" SET "estado"='ANULADO', "estadoInactivo"=true, "aprobacion"='Contrato nulo', "_updatedDate"=NOW()
        WHERE "contrato"=$1`, [BORRADOR]);
    for (const r of borr) {
      await c.query(
        `INSERT INTO "APROBACION_AUDIT"
           ("_id","personId","contrato","tipoUsuario","nombre","estadoAnterior","estadoNuevo","origen","motivo","usuarioEmail","_createdDate")
         VALUES ($1,$2,$3,$4,$5,$6,'Contrato nulo','SISTEMA',$7,'script:fix-145255171-raul-valenzuela',NOW())`,
        [`aud_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`, r._id, BORRADOR, r.tipoUsuario,
         [r.primerNombre, r.primerApellido].filter(Boolean).join(' '), r.aprobacion, MOTIVO]);
    }

    const ver = (await c.query(
      `SELECT "contrato","tipoUsuario","email","aprobacion","estado","estadoInactivo" FROM "PEOPLE"
        WHERE "contrato" IN ($1,$2) ORDER BY "contrato","tipoUsuario"`, [APROBADO, BORRADOR])).rows;
    console.log('Resultado (dentro de la transacción):'); console.table(ver);

    if (APPLY) { await c.query('COMMIT'); console.log('✅ APLICADO (COMMIT).'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: ROLLBACK, no se modificó nada. Use --apply para aplicar.'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR (ROLLBACK):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
})();
