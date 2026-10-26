/**
 * Plantilla de contrato CANJE (plataforma "Internacional").
 *
 *  1. ContractTemplates."tipoContract" (TEXT, nullable) — ADD COLUMN IF NOT EXISTS.
 *  2. Copia la fila de Chile como plataforma "Internacional" (si aún no existe).
 *  3. Reemplaza la plantilla de esa fila por la del contrato de canje
 *     (docs: "Contrato Canje.pdf") y fija tipoContract = 'Canje'.
 *
 * Mismas variables que el resto de plantillas (contract-template-filler.ts).
 * Dry-run por defecto (BEGIN…ROLLBACK); --apply hace COMMIT.
 *   node scripts/add-contract-template-canje.js [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { randomUUID } = require('crypto');

const APPLY = process.argv.includes('--apply');

const TEMPLATE_CANJE = `Número de contrato: {{contrato}}
Fecha: {{fecha}}

CONTRATO DE INSCRIPCIÓN — CANJE

Entre LETS GO SPEAK, empresa de giro de su denominación, RUC número 0993366498001, para efectos del presente Contrato denominada LGS y representada por la señora MABEL ALEJANDRA NUÑEZ CORDERO, cédula de identidad número 175335042-8, ambos domiciliados en Guayaquil Barrio: SAN EDUARDO Calle: AV DEL BOMBERO Número: 710 Intersección: VIA A LA COSTA Kilómetro: 6.5 Conjunto: LA VISTA SAN EDUARDO Edificio: 100 Número de piso: 7, y el titular identificado en el ítem N.º 1, se ha convenido el presente contrato.


ITEM Nº1 DATOS TITULAR

TITULAR:
{{datosTitular}}

ITEM Nº2
CONDICIONES GENERALES: A continuación, encontrará las condiciones únicas ofrecidas a usted y debidamente escritas que componen el presente contrato denominado también Uso de Membresía para el método LET´S GO SPEAK ADULTOS; tres niveles así: Nivel 1 Beginner, Nivel 2 Practical, Nivel 3 Functional duración 9 meses - tres meses adicionales para preparación de pruebas internacionales. La plantilla de horarios ofrecida es la siguiente: lunes a viernes 8:00 am a 8:00 pm sábado 8:00 am a 3:00 pm, el usuario deberá programar a través de la plataforma 2 horas académicas a la semana más 1 club obligatorio. También podrá programar 2 clubes opcionales, en las sesiones recibirá gramática, vocabulario y conversación, el usuario podrá consultar y descargar el material de apoyo en la plataforma. Estas sesiones podrán programarse máximo 1 por día.

El (los) usuario(s) del Programa para el aprendizaje del idioma inglés a través del Método denominado LETS GO SPEAK, será(n):

{{beneficiarios}}

ITEM Nº3
CLÁUSULAS LEGALES: El valor total del programa es 100% CANJE. Inscripción: CANJE. Saldo: CANJE. DURACIÓN 4 MESES.

COMPROMISOS PUBLICITARIOS
- 3 Reels semanales.
- 1 Historia mensual de avance.
- Entregar video de Reels e Historias para uso interno LGS.

LGS podrá repostear en sus redes oficiales las veces que estime conveniente dichos Reels e Historias.

El presente contrato permite al (los) Usuario(s) asistir a más sesiones o repetición de estas y a las actividades extra que proporcione LGS previa autorización de la coordinación académica de la empresa, sin que le generen costo adicional al ya pactado durante la vigencia de la misma, la cual es de 4 meses contados a partir de la firma del presente Contrato.

LGS se compromete a conservar y custodiar la información del titular con la debida diligencia para no ser utilizada sino únicamente para sus fines comerciales propios y los aquí acordados. El titular contratante autoriza a la empresa LGS a consultar y reportar la idoneidad del comportamiento financiero del adquiriente a las centrales de riesgo.

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


OBSERVACIONES: Canje por 4 meses, programa básico, renovable si ambas partes están de acuerdo. {{observaciones}}

CONTACTO:
Para envío de información, consultas o reclamos, serán por la vía email a: contacto@letsgospeak.cl

Declaro que he leído y conozco mis obligaciones y las de la Empresa LGS, certificándolo con mi aceptación del presente documento ya sea firmado en físico, respondiendo al email referenciado, firma electrónica o el simple hecho de reenviarlo desde mi correo sin omitir el renglón siguiente donde está la frase Si Acepto. Esta modalidad se considera suficiente y tiene mérito equivalente a la firma en físico o electrónica.

SI, ACEPTO.{{firma}}

{{nombreTitularFirma}}

Asesor Comercial: {{asesor}}
`;

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(`ALTER TABLE "ContractTemplates" ADD COLUMN IF NOT EXISTS "tipoContract" TEXT`);

    let fila = (await c.query(`SELECT "_id" FROM "ContractTemplates" WHERE LOWER("plataforma") = 'internacional' LIMIT 1`)).rows[0];
    if (!fila) {
      const chile = (await c.query(`SELECT * FROM "ContractTemplates" WHERE LOWER("plataforma") = 'chile' LIMIT 1`)).rows[0];
      if (!chile) throw new Error('No existe la plantilla de Chile');
      fila = (await c.query(
        `INSERT INTO "ContractTemplates" ("_id","_owner","_createdDate","_updatedDate","plataforma","template","origen")
         VALUES ($1,$2,NOW(),NOW(),'Internacional',$3,'POSTGRES') RETURNING "_id"`,
        [randomUUID(), chile._owner, chile.template])).rows[0];
      console.log('Copiada la plantilla de Chile como Internacional:', fila._id);
    } else {
      console.log('Ya existe la fila Internacional:', fila._id);
    }

    await c.query(
      `UPDATE "ContractTemplates" SET "template" = $1, "tipoContract" = 'Canje', "_updatedDate" = NOW() WHERE "_id" = $2`,
      [TEMPLATE_CANJE, fila._id]);

    const r = (await c.query(`SELECT "_id","plataforma","tipoContract",LENGTH("template") largo FROM "ContractTemplates" ORDER BY "plataforma"`)).rows;
    console.table(r);
    const vars = [...new Set(TEMPLATE_CANJE.match(/\{\{\w+\}\}/g))];
    console.log('Variables de la plantilla Canje:', vars.join(' '));

    if (APPLY) { await c.query('COMMIT'); console.log('APLICADO'); }
    else { await c.query('ROLLBACK'); console.log('DRY-RUN: nada escrito (use --apply)'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  }
  await c.end();
})();
