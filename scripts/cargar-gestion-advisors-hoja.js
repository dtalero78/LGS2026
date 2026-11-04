/**
 * cargar-gestion-advisors-hoja.js — carga inicial de Gestión Advisors desde la hoja
 * "10 Octubre 2026 Horas Advisors" (DETAIL-CL / DETAIL-COL / DETAIL-ECU / DETAIL-KIDS).
 *
 *  1. Ficha de pago de los advisors existentes (por _id, mapeo revisado a mano):
 *     tipo (POR_HORAS / SEMIPLANTA / PLANTA), categoría (Mariana y Wilmar = INTERNACIONAL)
 *     y programa (Shirley y Verónica = AMBOS).
 *  2. Crea en ADVISORS las guías KIDS que no existen (programa KIDS, activas).
 *  3. Tarifas vigentes desde 2026-10-01 (las de la hoja), para POR_HORAS y SEMIPLANTA:
 *       Chile CLP 5.570 / 8.355 / 8.000 · Colombia COP 25.000 / 37.500 / 40.000
 *       Colombia INTERNACIONAL COP 30.000 / 37.500 / 40.000 · Ecuador USD 5 / 7,5 / 8
 *     (normal / festivo / exam. intern.). Kids usa las de LGS de su país (no se crean filas KIDS).
 *
 * Idempotente: no pisa tarifas existentes (ON CONFLICT DO NOTHING) ni crea guías dos veces
 * (busca por nombre). Respaldo de las filas de ADVISORS tocadas en docs/backup-*.json.
 * Dry-run por defecto; --apply escribe en una transacción.
 * Uso: node scripts/cargar-gestion-advisors-hoja.js [--apply]
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const rnd = () => Math.random().toString(36).slice(2, 11);

// ── 1. Advisors existentes (ADVISORS._id → ficha) ──
const FICHAS = {
  // Chile — "X HORAS" = por horas; "ACTIVO" sin horas = planta (ya marcados esPlanta); Chousal coordinador semiplanta
  'adv_1776896015875_tq3njvovr':            { n: 'Alan Martínez', tipo: 'POR_HORAS' },
  'adv_1780612658163_rawqh5l6u':            { n: 'Antonia Atala', tipo: 'POR_HORAS' },
  'adv_1780613614701_i2vkpiu88':            { n: 'Joseph Machado', tipo: 'POR_HORAS' },
  'adv_1780614156872_o4x6h5hfj':            { n: 'Josuá Rojas', tipo: 'POR_HORAS' },
  'eb1a28b3-f883-4e25-82fb-34c8d9d1ca18':   { n: 'Laura Torres', tipo: 'POR_HORAS' },
  'adv_1775668411365_ikdi4wdgp':            { n: 'Lorena Plaza', tipo: 'POR_HORAS' },
  '4b2ceff8-c7c4-4e7a-818f-43659c2e850e':   { n: 'Pamela Miranda', tipo: 'POR_HORAS' },
  '23f17986-4e51-4135-8385-4afa8f6cb8ec':   { n: 'Scarleth Morales', tipo: 'POR_HORAS' },
  '70976489-5d31-4b4d-9b26-5a4d09f59e26':   { n: 'Andrés Chousal', tipo: 'SEMIPLANTA' },
  '2e1a63e1-8862-42d5-b04d-c87e4613ca55':   { n: 'Ayleen Gallardo', tipo: 'PLANTA' },
  '65b950c1-b3be-4798-a908-d23b6cf1c227':   { n: 'Emiliano Rojo', tipo: 'PLANTA' },
  '0b90c648-1676-4f89-938f-22e326a798b0':   { n: 'Laura Ponce', tipo: 'PLANTA' },
  '196930b7-794e-4c79-8dd8-764fad433d4a':   { n: 'Ricardo Araus', tipo: 'PLANTA' },
  // Colombia — todos por horas; columna D=1 en la hoja = INTERNACIONAL
  'd3bc6153-851e-4ce8-b22f-fc5b5be16ae9':   { n: 'Aura Riaño', tipo: 'POR_HORAS' },
  '4aa0dd31-ad6e-4db6-a7e8-b9ca451f16dd':   { n: 'Carolina Arango', tipo: 'POR_HORAS' },
  '853f48f6-4553-4924-8c34-c1dc5b17b051':   { n: 'Javier Mejía', tipo: 'POR_HORAS' },
  '0e1b09e2-bdc2-4053-97b3-cf5f5b73beaa':   { n: 'Juan Esteban Calderón', tipo: 'POR_HORAS' },
  '1f978854-31ff-4a68-8c6f-3367d03a1eaf':   { n: 'Mariana Rodríguez', tipo: 'POR_HORAS', categoria: 'INTERNACIONAL' },
  'e67b78d5-48ba-4cb5-a490-eab712fc1d0c':   { n: 'Mireya Peña', tipo: 'POR_HORAS' },
  '3adcda9a-015c-4734-bc80-5260bb90620c':   { n: 'Sofía Riveros', tipo: 'POR_HORAS' },
  '9bdf0862-5ff9-46af-b521-0f20c7c2b519':   { n: 'Wilmar Cruz', tipo: 'POR_HORAS', categoria: 'INTERNACIONAL' },
  // Ecuador — Dario (2 cuentas) y Hernán (2 cuentas) semiplanta; Shirley coordinadora Kids + LGS
  'dblgs_1793728090754_fgi2ho':             { n: 'Dario Rubio (Advisor)', tipo: 'SEMIPLANTA' },
  '098ca45d-8f5c-445f-b0c9-7abe43b35755':   { n: 'Dario Rubio (Coordinador)', tipo: 'SEMIPLANTA' },
  '17a8041f-7974-4f37-a621-710c6f8dbcda':   { n: 'Hernán Tenorio', tipo: 'SEMIPLANTA' },
  '8452034d-d2b9-4869-b949-0745d0122e2b':   { n: 'Hernán Tenorio (Coordinador, inactiva)', tipo: 'SEMIPLANTA' },
  // kidsUserId = su usuario con rol guía en KIDS2026 (tienen además uno de coordinador)
  'af1beb65-84e5-462d-8217-dbd35c451b32':   { n: 'Shirley Oñate', tipo: 'SEMIPLANTA', programa: 'AMBOS', kidsUserId: '3e1d52aa-cdd5-4e84-91af-20b2ebe4eada' },
  'a7c9111d-770f-4bd0-8c2a-3498c800f5a1':   { n: 'Verónica Espinosa', tipo: 'POR_HORAS', programa: 'AMBOS', kidsUserId: 'f0cb3bf2-b10b-44b5-a204-2ced7ea40b00' },
  'da28b751-e566-4411-90b3-3442bfce9c64':   { n: 'Andrea Naranjo', tipo: 'POR_HORAS' },
  'aa41911f-4f25-4a67-aff5-3395683c9f4f':   { n: 'Camila Orellana', tipo: 'POR_HORAS' },
  '9fe1d196-5357-404d-881a-8f218a30233c':   { n: 'Camila Peña', tipo: 'POR_HORAS' },
  '57299341-e470-4a44-a02d-dcc64e8eca35':   { n: 'Daniela Porras', tipo: 'POR_HORAS' },
  '56dd2734-4315-482c-86e0-949785dd963d':   { n: 'Johana Ramírez', tipo: 'POR_HORAS' },
  '1c5cbd60-7b4b-48cb-b4d0-96ca37f8fa18':   { n: 'Joselyn Laglaguano', tipo: 'POR_HORAS' },
  '27f3d060-7d5c-41e5-bf83-903807749a63':   { n: 'Juan Fernando Jácome', tipo: 'POR_HORAS' },
  '94a27bcd-e595-4f4a-b7ca-fd71231a3737':   { n: 'María Gabriela García', tipo: 'POR_HORAS' },
  '6680563c-f900-4117-8cb0-a7204e2dbb57':   { n: 'Pamela Chasi', tipo: 'POR_HORAS' },
  'adv_1775663355982_ptu2l2w1z':            { n: 'Raissa Flores', tipo: 'POR_HORAS' },
  '9449f8dd-36a0-42c6-b5a8-5a8a09050d8a':   { n: 'Ricardo Saldaña', tipo: 'POR_HORAS' },
  '24988df4-cfdc-463d-8421-8821b8c8b42c':   { n: 'Samia Almeida', tipo: 'POR_HORAS' },
  '35ef322b-d885-4904-bc05-5f24a0d56589':   { n: 'Wilmer Collaguazo', tipo: 'POR_HORAS' },
};

// ── 2. Guías KIDS que no existen en ADVISORS (kidsUserId/email = su usuario guía en KIDS2026) ──
const GUIAS_KIDS = [
  { primerNombre: 'Diana Sofía', primerApellido: 'Barajas Duarte', pais: 'Colombia', kidsUserId: '6163926a-d425-44b7-a769-774a0db90f05', email: 'dianasofbd@gmail.com' },
  { primerNombre: 'Anderson Steven', primerApellido: 'Trochez Bonilla', pais: 'Colombia', kidsUserId: '776ac844-c6f2-4262-8477-72e63b1a3912', email: 'anderstevenbonilla@outlook.com' },
  { primerNombre: 'Cristian Camilo', primerApellido: 'Ochoa Gamboa', pais: 'Colombia', kidsUserId: '6b7bf7d3-8420-4687-b369-a7374ff9479c', email: 'camilogamboa1628@gmail.com' },
  { primerNombre: 'Pedro Emiliano', primerApellido: 'Kilson Ferreira', pais: 'Chile', kidsUserId: '141c6a22-a10d-420d-8b53-0c7571aeb702', email: 'pedroemilianokilsonferreira@gmail.com' },
  { primerNombre: 'Boris Danilo', primerApellido: 'Bautista Baquero', pais: 'Ecuador', kidsUserId: '68fcf89d-40e2-4d7f-89ed-e8332a7243ec', email: 'borisbautista1999@gmail.com' },
  { primerNombre: 'Kaela Carolina', primerApellido: 'Pando Yungazaca', pais: 'Ecuador', kidsUserId: '45a6dd40-1fff-464e-aa5c-9e9e1d1af0da', email: 'carolinapando11@gmail.com' },
  // Guía en KIDS que no figura en la hoja de octubre (país por su correo .com.co — revisar)
  { primerNombre: 'Miguel', primerApellido: 'Martinez', pais: 'Colombia', kidsUserId: 'ecea29eb-7b14-42ad-80b0-e332d6bbf465', email: 'miguel.martinez@letsgospeak.com.co' },
];

// ── 3. Tarifas (vigentes desde 2026-10-01) ──
const VIGENCIA = '2026-10-01';
const TARIFAS = [
  { pais: 'Chile', moneda: 'CLP', categoria: 'ESTANDAR', NORMAL: 5570, FESTIVO: 8355, EXAM_INTERN: 8000 },
  { pais: 'Colombia', moneda: 'COP', categoria: 'ESTANDAR', NORMAL: 25000, FESTIVO: 37500, EXAM_INTERN: 40000 },
  { pais: 'Colombia', moneda: 'COP', categoria: 'INTERNACIONAL', NORMAL: 30000, FESTIVO: 37500, EXAM_INTERN: 40000 },
  { pais: 'Ecuador', moneda: 'USD', categoria: 'ESTANDAR', NORMAL: 5, FESTIVO: 7.5, EXAM_INTERN: 8 },
];

(async () => {
  console.log(APPLY ? '== APPLY ==' : '== DRY-RUN (sin --apply no escribe) ==');
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''), ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const ids = Object.keys(FICHAS);
    const actuales = (await c.query(
      `SELECT "_id", "nombreCompleto", "tipoContratacion", "categoriaTarifa", "programa", "kidsUserId" FROM "ADVISORS" WHERE "_id" = ANY($1::text[])`, [ids])).rows;
    const porId = new Map(actuales.map((r) => [r._id, r]));
    const faltan = ids.filter((id) => !porId.has(id));
    if (faltan.length) throw new Error(`ADVISORS no encontrados: ${faltan.join(', ')}`);

    console.log('\n1) Fichas de pago:');
    const cambios = [];
    for (const [id, f] of Object.entries(FICHAS)) {
      const a = porId.get(id);
      const nuevo = { tipoContratacion: f.tipo, categoriaTarifa: f.categoria || 'ESTANDAR', programa: f.programa || 'LGS', kidsUserId: f.kidsUserId || a.kidsUserId || null };
      const dif = Object.entries(nuevo).filter(([k, v]) => (a[k] ?? null) !== v);
      if (dif.length) cambios.push({ id, nuevo });
      console.log(`  ${dif.length ? '→' : '='} ${a.nombreCompleto.padEnd(40)} ${nuevo.tipoContratacion.padEnd(10)} ${nuevo.categoriaTarifa.padEnd(13)} ${nuevo.programa}`);
    }

    console.log('\n2) Guías KIDS nuevas:');
    const crear = [];
    for (const g of GUIAS_KIDS) {
      const nombre = `${g.primerNombre} ${g.primerApellido}`;
      const ya = (await c.query(`SELECT "_id" FROM "ADVISORS" WHERE LOWER(TRIM("nombreCompleto")) = LOWER($1)`, [nombre])).rows[0];
      console.log(`  ${ya ? '= ya existe' : '+ crear   '} ${nombre} (${g.pais})`);
      if (!ya) crear.push({ ...g, nombre });
    }

    console.log(`\n3) Tarifas desde ${VIGENCIA} (POR_HORAS y SEMIPLANTA):`);
    const filasTarifa = [];
    for (const t of TARIFAS) for (const tipo of ['POR_HORAS', 'SEMIPLANTA']) for (const concepto of ['NORMAL', 'FESTIVO', 'EXAM_INTERN']) {
      filasTarifa.push([t.pais, 'LGS', tipo, t.categoria, concepto, t.moneda, t[concepto]]);
    }
    for (const t of TARIFAS) console.log(`  ${t.pais.padEnd(9)} ${t.categoria.padEnd(13)} ${t.moneda} normal ${t.NORMAL} · festivo ${t.FESTIVO} · exam ${t.EXAM_INTERN}`);

    console.log(`\nResumen: ${cambios.length} fichas a actualizar, ${crear.length} guías a crear, ${filasTarifa.length} tarifas (se omiten las que ya existan).`);
    if (!APPLY) return;

    const backup = `docs/backup-gestion-advisors-carga-${Date.now()}.json`;
    fs.writeFileSync(backup, JSON.stringify(actuales, null, 2));
    console.log(`Respaldo: ${backup}`);

    await c.query('BEGIN');
    for (const { id, nuevo } of cambios) {
      await c.query(
        `UPDATE "ADVISORS" SET "tipoContratacion"=$2, "categoriaTarifa"=$3, "programa"=$4, "kidsUserId"=$5, "_updatedDate"=NOW() WHERE "_id"=$1`,
        [id, nuevo.tipoContratacion, nuevo.categoriaTarifa, nuevo.programa, nuevo.kidsUserId]);
    }
    for (const g of crear) {
      await c.query(
        `INSERT INTO "ADVISORS" ("_id","primerNombre","primerApellido","nombreCompleto","email","pais","activo","esPlanta","programa","tipoContratacion","kidsUserId","_createdDate","_updatedDate")
         VALUES ($1,$2,$3,$4,$5,$6,true,false,'KIDS','POR_HORAS',$7,NOW(),NOW())`,
        [`adv_${Date.now()}_${rnd()}`, g.primerNombre, g.primerApellido, g.nombre, g.email, g.pais, g.kidsUserId]);
    }
    let insT = 0;
    for (const f of filasTarifa) {
      const r = await c.query(
        `INSERT INTO "TARIFAS_ADVISOR" ("_id","pais","programa","tipo","categoria","concepto","moneda","valor","vigenteDesde","creadoPor")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,'carga-hoja-oct-2026') ON CONFLICT ON CONSTRAINT "tarifas_advisor_uq" DO NOTHING`,
        [`tar_${Date.now()}_${rnd()}`, ...f, VIGENCIA]);
      insT += r.rowCount;
    }
    await c.query(
      `INSERT INTO "LIQ_ADVISOR_LOG" ("_id","accion","detalle","usuarioEmail") VALUES ($1,'CARGA_INICIAL',$2,'script')`,
      [`lql_${Date.now()}_${rnd()}`, JSON.stringify({ fichas: cambios.length, guiasCreadas: crear.map((g) => g.nombre), tarifas: insT, backup })]);
    await c.query('COMMIT');
    console.log(`✔ ${cambios.length} fichas · ${crear.length} guías creadas · ${insT} tarifas insertadas.`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
