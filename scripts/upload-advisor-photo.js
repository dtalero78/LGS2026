// Sube una foto a DO Spaces y la asigna a un advisor existente (ADVISORS.fotoAdvisor).
//
// Útil para casos puntuales donde un advisor se creó sin foto (registros
// anteriores a la regla de "foto obligatoria") y necesita una foto a mano
// sin pedirle al advisor que la suba él mismo via /advisor-setup.
//
// Uso:
//   node scripts/upload-advisor-photo.js --advisor <email_o_id> --file <ruta-foto>
//
// Ejemplos:
//   node scripts/upload-advisor-photo.js --advisor marisrodriguezn@gmail.com --file ./mariana.jpg
//   node scripts/upload-advisor-photo.js --advisor 1f978854-31ff-4a68-8c6f-3367d03a1eaf --file ./foto.png
//
// El script:
//   1) Resuelve advisor por email (case-insensitive + TRIM) o _id
//   2) Lee el archivo local y detecta su content-type por extensión
//   3) Sube a DO Spaces con key fotosAdvisors/<advisor_id>_<timestamp>.<ext>
//   4) UPDATE ADVISORS SET fotoAdvisor=$1, _updatedDate=NOW() WHERE _id=$2
//   5) Imprime la key resultante para verificación
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const advisorIdx = process.argv.indexOf('--advisor');
const fileIdx    = process.argv.indexOf('--file');
const ADVISOR_ARG = advisorIdx >= 0 ? process.argv[advisorIdx + 1] : null;
const FILE_PATH   = fileIdx >= 0 ? process.argv[fileIdx + 1] : null;

if (!ADVISOR_ARG || !FILE_PATH) {
  console.error('\n❌ Argumentos faltantes.\n');
  console.error('Uso:');
  console.error('  node scripts/upload-advisor-photo.js --advisor <email_o_id> --file <ruta-foto>\n');
  process.exit(1);
}

if (!fs.existsSync(FILE_PATH)) {
  console.error(`\n❌ Archivo no encontrado: ${FILE_PATH}\n`);
  process.exit(1);
}

const EXT_TO_MIME = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // 1) Resolver advisor
    const advisor = await pool.query(
      `SELECT "_id","email","nombreCompleto","fotoAdvisor"
         FROM "ADVISORS"
        WHERE "_id" = $1
           OR LOWER(TRIM("email")) = LOWER(TRIM($1))
        LIMIT 1`,
      [ADVISOR_ARG]
    );
    if (!advisor.rowCount) {
      console.error(`\n❌ Advisor no encontrado: ${ADVISOR_ARG}\n`);
      process.exit(1);
    }
    const adv = advisor.rows[0];
    console.log(`\n📋 Advisor resuelto:`);
    console.log(`   _id           : ${adv._id}`);
    console.log(`   nombre        : ${adv.nombreCompleto}`);
    console.log(`   email         : ${adv.email}`);
    console.log(`   foto actual   : ${adv.fotoAdvisor || '(sin foto)'}`);

    // 2) Leer archivo y detectar mime
    const ext = path.extname(FILE_PATH).toLowerCase();
    const contentType = EXT_TO_MIME[ext];
    if (!contentType) {
      console.error(`\n❌ Extensión no soportada: ${ext}. Use .jpg/.jpeg/.png/.webp/.gif\n`);
      process.exit(1);
    }
    const fileBuffer = fs.readFileSync(FILE_PATH);
    const fileSize = fileBuffer.length;
    console.log(`\n📦 Archivo:`);
    console.log(`   path          : ${FILE_PATH}`);
    console.log(`   tamaño        : ${(fileSize / 1024).toFixed(1)} KB`);
    console.log(`   content-type  : ${contentType}`);

    // 3) Subir a DO Spaces
    const s3 = new S3Client({
      endpoint: process.env.DO_SPACES_ENDPOINT || 'https://sfo3.digitaloceanspaces.com',
      region:   process.env.DO_SPACES_REGION   || 'sfo3',
      credentials: {
        accessKeyId:     process.env.DO_SPACES_KEY || '',
        secretAccessKey: process.env.DO_SPACES_SECRET || '',
      },
      forcePathStyle: false,
    });
    const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'lgs-bucket';
    const timestamp = Date.now();
    const key = `fotosAdvisors/${adv._id}_${timestamp}${ext}`;

    console.log(`\n☁️  Subiendo a DO Spaces...`);
    console.log(`   bucket        : ${SPACES_BUCKET}`);
    console.log(`   key           : ${key}`);

    await s3.send(new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key:    key,
      Body:   fileBuffer,
      ContentType: contentType,
      ACL:    'private',
    }));
    console.log(`   ✅ Subida OK`);

    // 4) Actualizar ADVISORS
    console.log(`\n💾 Actualizando ADVISORS.fotoAdvisor...`);
    await pool.query(
      `UPDATE "ADVISORS" SET "fotoAdvisor" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
      [key, adv._id]
    );

    // 5) Verificar
    const verify = await pool.query(
      `SELECT "fotoAdvisor" FROM "ADVISORS" WHERE "_id" = $1`,
      [adv._id]
    );
    console.log(`   ✅ ADVISORS.fotoAdvisor = ${verify.rows[0].fotoAdvisor}`);

    console.log(`\n🎉 LISTO. La foto aparecerá en /panel-advisor del advisor y en cualquier vista que use presigned URLs.`);
    console.log(`   Si el advisor ya estaba logueado, deberá refrescar el navegador (Ctrl+Shift+R).\n`);
  } catch (err) {
    console.error('\n❌ Error:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
