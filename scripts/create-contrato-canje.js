/**
 * Contrato CANJE (botón CANJE de Crear Contrato + Aprobación › Contratos Canje).
 *
 *   --fase=columnas    PEOPLE."tipoContrato" (TEXT; 'CANJE' o NULL = estándar) y
 *                      PEOPLE."condicionesCanje" (JSONB, array de textos, titular).
 *                      Correr ANTES de desplegar el código que las lee.
 *   --fase=plantillas  Una plantilla de canje por país en "ContractTemplates"
 *                      (tipoContract = 'Canje'): el encabezado de la plantilla
 *                      estándar del país (empresa que firma) + el cuerpo del canje
 *                      con {{totalPlan}}, {{vigencia}} y {{condicionesCanje}}. Borra
 *                      la fila provisional "Internacional". Correr DESPUÉS de
 *                      desplegar (el código viejo no distingue tipos de plantilla).
 *
 * Idempotente. Dry-run por defecto (BEGIN…ROLLBACK); --apply hace COMMIT.
 *   node scripts/create-contrato-canje.js --fase=columnas [--apply]
 *   node scripts/create-contrato-canje.js --fase=plantillas [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const APPLY = process.argv.includes('--apply');
const FASE = (process.argv.find(a => a.startsWith('--fase=')) || '').split('=')[1];
const PAISES = ['Chile', 'Colombia', 'Ecuador', 'Perú'];

const CUERPO_CANJE = `ITEM Nº1 DATOS TITULAR

TITULAR:
{{datosTitular}}

ITEM Nº2
CONDICIONES GENERALES: A continuación, encontrará las condiciones únicas ofrecidas a usted y debidamente escritas que componen el presente contrato denominado también Uso de Membresía para el método LET´S GO SPEAK ADULTOS; tres niveles así: Nivel 1 Beginner, Nivel 2 Practical, Nivel 3 Functional. La plantilla de horarios ofrecida es la siguiente: lunes a viernes 8:00 am a 8:00 pm sábado 8:00 am a 3:00 pm, el usuario deberá programar a través de la plataforma 2 horas académicas a la semana más 1 club obligatorio. También podrá programar 2 clubes opcionales, en las sesiones recibirá gramática, vocabulario y conversación, el usuario podrá consultar y descargar el material de apoyo en la plataforma. Estas sesiones podrán programarse máximo 1 por día.

El (los) usuario(s) del Programa para el aprendizaje del idioma inglés a través del Método denominado LETS GO SPEAK, será(n):

{{beneficiarios}}

ITEM Nº3
CLÁUSULAS LEGALES — CONTRATO DE CANJE: El valor del programa es de $ {{totalPlan}}, pagado en su totalidad mediante CANJE; no tiene inscripción ni cuotas. DURACIÓN: {{vigencia}} MESES.

CONDICIONES DEL CANJE:
{{condicionesCanje}}

El presente contrato permite al (los) Usuario(s) asistir a más sesiones o repetición de estas y a las actividades extra que proporcione LGS previa autorización de la coordinación académica de la empresa, sin que le generen costo adicional al ya pactado durante la vigencia de la misma, la cual es de {{vigencia}} meses contados a partir de la firma del presente Contrato. El canje es renovable si ambas partes están de acuerdo.

LGS se compromete a conservar y custodiar la información del titular con la debida diligencia para no ser utilizada sino únicamente para sus fines comerciales propios y los aquí acordados.

Para el programa LET´S GO SPEAK ADULTOS, LGS no asigna horarios fijos para que el usuario tome sus sesiones, estos son programables y se deben realizar con 24 horas de anticipación mínimo y máximo 5 minutos antes de iniciar la sesión.

La plantilla de horarios disponibles la asignará LGS con 24 a 48 horas de anticipación, la cual se podrá visualizar en la plataforma.
Para reservar su siguiente sesión solo lo podrá hacer una vez culminada la sesión en curso.

PRUEBAS INTERNACIONALES LET´S GO SPEAK ADULTOS.
La Empresa LGS dará preparación a una prueba internacional, una vez terminado el Programa en su totalidad, de acuerdo a la prueba y cupo disponibles.

GARANTÍA.
La Empresa LGS entrega una garantía de aprendizaje fundamentada en el cumplimiento por parte del Usuario en todos los requisitos necesarios para la correcta utilización del método, incluyendo en estos la preparación en casa y la asistencia mínima de tres veces a la semana a sus sesiones. Este periodo de garantía se asignará según el Diagnóstico realizado por la Empresa.

COMPROMISOS ADICIONALES DEL TITULAR Y/O USUARIO.
Realizar prácticas diarias de 20 minutos promedio en el caso de LGS Adultos y en el de KIDS 20 minutos diarios tres veces a la semana; para todos los casos asistir a sus sesiones con cámara encendida, para que el proceso de aprendizaje del idioma inglés dé sus frutos en los plazos requeridos por el método LETS GO SPEAK.

Informar a las directivas de la Empresa LGS de cualquier ofrecimiento realizado por algún miembro de la empresa que no esté en el presente contrato, incluyendo la asignación de algún Beneficiario o Usuario para que haga parte de este Contrato en cualquiera de sus obligaciones o beneficios.

El Titular del presente Contrato declara que acepta claramente todas sus obligaciones y las de La Empresa LGS, garantizando así la transparencia de esta relación comercial y calificando al Ejecutivo o empleado de la misma como una persona profesional y clara en su ofrecimiento del programa LETS GO SPEAK. Además, debe informar a las directivas de la Empresa de cualquier acuerdo realizado por algún miembro de la empresa que no esté en el presente contrato.


OBSERVACIONES: {{observaciones}}

CONTACTO:
Para envío de información, consultas o reclamos, serán por la vía email a: contacto@letsgospeak.cl

Declaro que he leído y conozco mis obligaciones y las de la Empresa LGS, certificándolo con mi aceptación del presente documento ya sea firmado en físico, respondiendo al email referenciado, firma electrónica o el simple hecho de reenviarlo desde mi correo sin omitir el renglón siguiente donde está la frase Si Acepto. Esta modalidad se considera suficiente y tiene mérito equivalente a la firma en físico o electrónica.

SI, ACEPTO.{{firma}}

{{nombreTitularFirma}}

Asesor Comercial: {{asesor}}
`;

(async () => {
  if (!['columnas', 'plantillas'].includes(FASE)) {
    console.error('Indica --fase=columnas o --fase=plantillas'); process.exit(1);
  }
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query('BEGIN');
    if (FASE === 'columnas') {
      await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "tipoContrato" TEXT`);
      await c.query(`ALTER TABLE "PEOPLE" ADD COLUMN IF NOT EXISTS "condicionesCanje" JSONB`);
      const r = (await c.query(`SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name='PEOPLE' AND column_name IN ('tipoContrato','condicionesCanje')`)).rows;
      console.table(r);
    } else {
      await c.query(`ALTER TABLE "ContractTemplates" ADD COLUMN IF NOT EXISTS "tipoContract" TEXT`);
      for (const pais of PAISES) {
        const std = (await c.query(
          `SELECT "_owner","template" FROM "ContractTemplates"
            WHERE LOWER("plataforma") = LOWER($1) AND "tipoContract" IS NULL LIMIT 1`, [pais])).rows[0];
        if (!std) throw new Error(`No hay plantilla estándar de ${pais}`);
        const m = std.template.match(/ITEM\s*N[º°o]\.?\s*1/i);
        if (!m) throw new Error(`La plantilla de ${pais} no tiene "ITEM Nº1": no se puede tomar su encabezado`);
        const encabezado = std.template.slice(0, m.index).replace(/\s+$/, '') + '\n\nCONTRATO DE CANJE\n\n\n';
        const plantilla = encabezado + CUERPO_CANJE;
        const ya = (await c.query(
          `SELECT "_id" FROM "ContractTemplates" WHERE LOWER("plataforma") = LOWER($1) AND LOWER("tipoContract") = 'canje' LIMIT 1`, [pais])).rows[0];
        if (ya) {
          await c.query(`UPDATE "ContractTemplates" SET "template"=$1, "_updatedDate"=NOW() WHERE "_id"=$2`, [plantilla, ya._id]);
        } else {
          await c.query(
            `INSERT INTO "ContractTemplates" ("_id","_owner","_createdDate","_updatedDate","plataforma","template","origen","tipoContract")
             VALUES ($1,$2,NOW(),NOW(),$3,$4,'POSTGRES','Canje')`, [randomUUID(), std._owner, pais, plantilla]);
        }
        console.log(`\n===== ${pais}: ${ya ? 'actualizada' : 'creada'} — encabezado tomado de su plantilla estándar =====\n${encabezado.trim()}\n`);
      }
      const del = await c.query(`DELETE FROM "ContractTemplates" WHERE LOWER("plataforma") = 'internacional'`);
      console.log(`Fila provisional "Internacional" borrada: ${del.rowCount}`);
      console.table((await c.query(`SELECT "plataforma","tipoContract",LENGTH("template") largo FROM "ContractTemplates" ORDER BY 1, 2 NULLS FIRST`)).rows);
    }
    if (APPLY) { await c.query('COMMIT'); console.log('APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: nada escrito (use --apply)'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', e.message); process.exitCode = 1;
  }
  await c.end();
})();
