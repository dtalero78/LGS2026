/**
 * update-contract-templates-empresa.js
 *
 * Utilidad: adapta las 4 plantillas de ContractTemplates (Chile, Colombia,
 * Ecuador, Perú) para que sirvan tanto a persona natural como a EMPRESA, sin
 * duplicarlas. Sustituye los 3 bloques que dependen del tipo de persona por
 * placeholders que arma `contract-template-filler.ts` según `tipoPersona`:
 *
 *   1. ITEM Nº1 · datos del titular   → {{datosTitular}}
 *   2. REFERENCIAS (se omiten en empresa) → {{referencias}}
 *   3. Cierre "Nombre del titular…"   → {{nombreTitularFirma}}
 *
 * El ~90% restante (el texto legal) queda intacto y sigue siendo UNO SOLO por
 * país: por eso no hacen falta 8 plantillas.
 *
 * Uso:
 *   node scripts/update-contract-templates-empresa.js            (dry-run)
 *   node scripts/update-contract-templates-empresa.js --apply    (escribe)
 *
 * Idempotente: si la plantilla ya contiene {{datosTitular}}, la omite.
 * Antes de escribir guarda un backup de las 4 plantillas en docs/.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const NL = String.fromCharCode(10);

// --- Bloques a sustituir (idénticos en las 4 plantillas salvo lo indicado) ---
const BLOQUE_DATOS = [
  'Nombre Completo: {{primerNombre}} {{segundoNombre}} {{primerApellido}} {{segundoApellido}}',
  'Documento: {{numeroId}}',
  'Fecha de Nacimiento: {{fechaNacimiento}}',
  'Domicilio: {{domicilio}}',
  'Ciudad: {{ciudad}}',
  'Teléfono: {{celular}}',
  'Correo: {{email}}',
  'Ingresos: {{ingresos}}',
  'Empresa: {{empresa}}',
  'Cargo: {{cargo}}',
].join(NL);

// Ecuador usa "REFERENCIA:" (singular); el resto "REFERENCIAS:".
const bloqueRefs = (encabezado) => [
  encabezado,
  '- Nombre: {{referenciaUno}}',
  '- Parentesco: {{parentezcoRefUno}}',
  '- Teléfono: {{telefonoRefUno}}',
  '',
  '- Nombre: {{referenciaDos}}',
  '- Parentesco: {{parentezcoRefDos}}',
  '- Teléfono: {{telefonoRefDos}}',
].join(NL);

const BLOQUE_CIERRE = [
  'Nombre del titular: {{primerNombre}} {{segundoNombre}} {{primerApellido}} {{segundoApellido}}',
  'Número de Identificación: {{numeroId}}',
].join(NL);

function transformar(tpl) {
  const cambios = [];
  let out = tpl.replace(/\r\n/g, NL);

  if (out.includes('{{datosTitular}}')) return { out: tpl, cambios: null };

  if (out.includes(BLOQUE_DATOS)) {
    out = out.replace(BLOQUE_DATOS, '{{datosTitular}}');
    cambios.push('datosTitular');
  }
  for (const enc of ['REFERENCIAS:', 'REFERENCIA:']) {
    const b = bloqueRefs(enc);
    if (out.includes(b)) { out = out.replace(b, '{{referencias}}'); cambios.push('referencias (' + enc + ')'); break; }
  }
  if (out.includes(BLOQUE_CIERRE)) {
    out = out.replace(BLOQUE_CIERRE, '{{nombreTitularFirma}}');
    cambios.push('nombreTitularFirma');
  }
  return { out, cambios };
}

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    'SELECT "_id", "plataforma", "template" FROM "ContractTemplates" ORDER BY "plataforma"'
  );

  // Backup SIEMPRE antes de tocar nada.
  const docs = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docs)) fs.mkdirSync(docs, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkPath = path.join(docs, `contract-templates-backup-${stamp}.json`);
  fs.writeFileSync(bkPath, JSON.stringify(rows, null, 2));
  console.log('Backup de las 4 plantillas ->', bkPath);
  console.log('');

  let aplicadas = 0, omitidas = 0;
  for (const r of rows) {
    const { out, cambios } = transformar(r.template);
    if (cambios === null) { console.log(`  ${r.plataforma.padEnd(9)} ya migrada (tiene {{datosTitular}}) — omitida`); omitidas++; continue; }
    if (cambios.length === 0) { console.log(`  ${r.plataforma.padEnd(9)} ⚠ ningún bloque coincidió — revisar a mano`); continue; }

    console.log(`  ${r.plataforma.padEnd(9)} ${cambios.join(' + ')}  (${r.template.length} -> ${out.length} chars)`);
    if (APPLY) {
      await client.query(
        'UPDATE "ContractTemplates" SET "template" = $1, "_updatedDate" = NOW() WHERE "_id" = $2',
        [out, r._id]
      );
      aplicadas++;
    }
  }

  console.log('');
  console.log(APPLY ? `APLICADO: ${aplicadas} plantilla(s) actualizadas, ${omitidas} omitidas.`
                    : `DRY-RUN: nada se escribió. Repetir con --apply para aplicar.`);
  await client.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
