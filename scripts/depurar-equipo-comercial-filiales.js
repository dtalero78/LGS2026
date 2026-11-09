/**
 * depurar-equipo-comercial-filiales.js  (2026-11-09)
 *
 * Revisión de EQUIPO_COMERCIAL sin filial (los que no cubre sync-filiales.js):
 *  1. Filial probable por la escalera: el comercial no tiene contratos con filial pero
 *     aparece como jefe/gerente en contratos que sí la traen del CRM. Solo llena vacías.
 *  2. Cuenta de ingreso de Mayra de la Hoz (rol COMERCIAL, país "Internacional") →
 *     filial MIRMIDONES y país Colombia (como su otro registro).
 *  3. Desactiva (activo=false, nunca borra) registros de prueba, duplicados y correos
 *     mal escritos. EQUIPO_COMERCIAL.activo es informativo: no bloquea login ni contratos.
 *
 * Cada correo debe coincidir con exactamente 1 fila o el script se detiene.
 * Dry-run por defecto; --apply escribe en una transacción.
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

// [patrón de correo (LIKE, minúsculas), filial]
const FILIALES = [
  ['piaanahipa@letsgospeak.cl', 'OLIMPO'],
  ['m.rebolledo@letsgospeak.cl', 'OLIMPO'],
  ['johana.letsgospeak@gmail.com', 'OLIMPO'],
  ['fernanda.pacheco@gmail.com', 'OLIMPO'],
  ['camilabelen.sotosoto@letsgospeak.c%', 'ATLANTIDA'],
  ['camilabelensotosoto@letsgospeak.cl', 'ATLANTIDA'],
  ['mb.altamiranom@letsgospeak.com', 'ATLANTIDA'],
  ['michelvargas9703@gmail.com', 'MIRMIDONES'],
  ['michelvargas970@gmail.com', 'MIRMIDONES'],
  ['j.molina@letsgospeak.com.co', 'MIRMIDONES'],
  ['claudiamonsalveg@letsgospeak.cl', 'AFRICA'],
  ['claudiamonsalveclaro@gmail.com', 'AFRICA'],
];
const MAYRA = 'mdc.delahozc@letsgospeak.com.co';
// [correo, motivo]
const DESACTIVAR = [
  ['tddirectorlgs@gmail.com', 'prueba (Miguel Martínez)'],
  ['contrato@multiple.com', 'prueba (Miguel Martínez)'],
  ['miguel.martinez@hotmail.com', 'prueba (Miguel Martínez)'],
  ['miguel.martinez@letsgospeak.com.co', 'prueba (Miguel Martínez)'],
  ['hernan@gamail.com', 'correo mal escrito (Hernán Tenorio)'],
  ['camiaguayo@gmail.com', 'duplicado de Camila Aguayo'],
  ['rayen.gonzalez.c@gmail.com', 'duplicado de Rayen González'],
  ['msanchezalamo@gmail.com', 'duplicado de Marcia Sánchez'],
  ['nataliaecuador@ecuador.ec', 'correo ficticio (Natalia Ramos)'],
  ['nikrameri@mosaicosoroban.cl', 'correo de Mosaico (Javiera Carvajal)'],
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const una = async (patron) => {
    const r = await c.query(`SELECT "_id","nombre","correo","plataforma","filial","activo" FROM "EQUIPO_COMERCIAL" WHERE LOWER(TRIM("correo")) LIKE $1`, [patron]);
    if (r.rows.length !== 1) throw new Error(`"${patron}" coincide con ${r.rows.length} filas (se esperaba 1)`);
    return r.rows[0];
  };
  try {
    const plan = [];
    for (const [p, f] of FILIALES) {
      const e = await una(p);
      if ((e.filial || '').trim()) { console.log(`  = ${e.correo} ya tiene ${e.filial}`); continue; }
      plan.push({ accion: 'filial', id: e._id, correo: e.correo, nombre: e.nombre, valor: f });
    }
    const m = await una(MAYRA);
    if (!(m.filial || '').trim() || m.plataforma !== 'Colombia')
      plan.push({ accion: 'filial+pais', id: m._id, correo: m.correo, nombre: m.nombre, valor: 'MIRMIDONES / Colombia' });
    for (const [p, motivo] of DESACTIVAR) {
      const e = await una(p);
      if (e.activo === false) { console.log(`  = ${e.correo} ya inactivo`); continue; }
      plan.push({ accion: 'desactivar', id: e._id, correo: e.correo, nombre: e.nombre, valor: motivo });
    }
    console.table(plan.map(({ id, ...x }) => x));
    if (!APPLY) { console.log('(dry-run — use --apply para escribir)'); return; }

    await c.query('BEGIN');
    try {
      for (const x of plan) {
        if (x.accion === 'filial')
          await c.query(`UPDATE "EQUIPO_COMERCIAL" SET "filial"=$2,"_updatedDate"=NOW() WHERE "_id"=$1 AND COALESCE(TRIM("filial"),'')=''`, [x.id, x.valor]);
        else if (x.accion === 'filial+pais')
          await c.query(`UPDATE "EQUIPO_COMERCIAL" SET "filial"='MIRMIDONES',"plataforma"='Colombia',"_updatedDate"=NOW() WHERE "_id"=$1`, [x.id]);
        else
          await c.query(`UPDATE "EQUIPO_COMERCIAL" SET "activo"=false,"_updatedDate"=NOW() WHERE "_id"=$1`, [x.id]);
      }
      await c.query('COMMIT');
      console.log(`✅ ${plan.length} cambios aplicados.`);
    } catch (e) { await c.query('ROLLBACK'); throw e; }
  } finally { await c.end(); }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
