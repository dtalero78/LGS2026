/**
 * Contrato 01-16720-26: cambia el TITULAR (Priscila Moraga → Marcelo Maulen Parada). Los beneficiarios
 * (Christell Maulen y Priscila Moraga) y los datos financieros no se tocan. Como el titular cambia, se
 * borra la firma (OTP de Priscila) y el PDF firmado en Drive: Marcelo debe firmar. Dry-run por defecto; --apply escribe.
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');
const apply = process.argv.includes('--apply');
const TITULAR = 'prs_1795528859388_7k52lf2qn';
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const antes = (await c.query(`SELECT * FROM "PEOPLE" WHERE "_id"=$1 AND "contrato"='01-16720-26' AND "tipoUsuario"='TITULAR'`, [TITULAR])).rows[0];
    if (!antes) throw new Error('titular no encontrado');
    if (String(antes.aprobacion || '').trim()) throw new Error('el contrato ya tiene estado de aprobación');
    const pago = (await c.query(`SELECT * FROM "PAGOS_TITULARES" WHERE "idPeople"=$1`, [TITULAR])).rows;
    console.log('titular actual:', antes.primerNombre, antes.primerApellido, antes.numeroId, '· pagos:', pago.length);
    if (!apply) { console.log('(dry-run — use --apply)'); return; }
    fs.writeFileSync(`docs/backup-cambio-titular-16720-${Date.now()}.json`, JSON.stringify({ titular: antes, pagos: pago }, null, 1));
    await c.query('BEGIN');
    await c.query(
      `UPDATE "PEOPLE" SET "numeroId"='128290710',"primerNombre"='Marcelo',"segundoNombre"='Andrés',"primerApellido"='Maulen',"segundoApellido"='Parada',
              "nombreCompleto"='Marcelo Andrés Maulen Parada',"celular"='56973379753',"telefono"='56973379753',"fechaNacimiento"='1975-03-11',
              "cargo"='Técnico Electricista',"empresa"='Minera Escondida',"ingresos"='1200000',"email"=NULL,"genero"=NULL,
              "consentimientoDeclarativo"=NULL,"hashConsentimiento"=NULL,"numeroDocumentoVerificado"=NULL,"driveFileId"=NULL,"_updatedDate"=NOW()
        WHERE "_id"=$1`, [TITULAR]);
    await c.query(`UPDATE "PAGOS_TITULARES" SET "numeroId"='128290710' WHERE "idPeople"=$1`, [TITULAR]);
    await c.query('COMMIT');
    console.log('APLICADO');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); console.error('ERROR', e.message); process.exit(1); }
  finally { await c.end(); }
})();
