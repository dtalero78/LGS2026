import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

interface ApproveResult {
  personId: string;
  nombre: string;
  academicId: string | null;
  academicCreated: boolean;
  whatsappSent: boolean;
  whatsappError: string | null;
}

/**
 * Approve a single person: update PEOPLE, create ACADEMICA, send WhatsApp.
 * Reusable for both titular and beneficiario approval.
 */
async function approveOnePerson(personId: string, contrato: string | null): Promise<ApproveResult> {
  const person = await queryOne(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );
  if (!person) throw new NotFoundError('Person', personId);

  // Skip if already approved
  if (person.aprobacion === 'Aprobado') {
    console.log(`ℹ️ [Approve] ${person.primerNombre} ya está aprobado, saltando`);
    // Still return info so caller knows
    const existingAcademic = await queryOne(
      `SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`,
      [person.numeroId]
    );
    return {
      personId,
      nombre: `${person.primerNombre} ${person.primerApellido}`,
      academicId: existingAcademic?._id || null,
      academicCreated: false,
      whatsappSent: false,
      whatsappError: 'Ya estaba aprobado',
    };
  }

  console.log(`🟢 [Approve] Aprobando ${person.tipoUsuario}: ${person.primerNombre} ${person.primerApellido} (${personId})`);

  // Use provided contrato or person's own
  const effectiveContrato = contrato || person.contrato;

  // Update PEOPLE.aprobacion = 'Aprobado' (+ copy contrato for beneficiarios without one)
  if (person.tipoUsuario === 'BENEFICIARIO' && effectiveContrato && !person.contrato) {
    await query(
      `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "contrato" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
      [effectiveContrato, personId]
    );
  } else {
    await query(
      `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "_updatedDate" = NOW() WHERE "_id" = $1`,
      [personId]
    );
  }
  console.log(`✅ [Approve] PEOPLE.aprobacion actualizado a 'Aprobado'`);

  // Check/Create ACADEMICA record
  const existingAcademic = await queryOne(
    `SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`,
    [person.numeroId]
  );

  let academicId = existingAcademic?._id;
  let academicCreated = false;

  if (!existingAcademic) {
    academicId = ids.academic();
    await query(
      `INSERT INTO "ACADEMICA" (
        "_id", "numeroId", "primerNombre", "segundoNombre",
        "primerApellido", "segundoApellido", "email", "celular",
        "nivel", "step", "plataforma", "estadoInactivo",
        "contrato", "usuarioId",
        "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, $13, NOW(), NOW()
      )`,
      [
        academicId,
        person.numeroId,
        person.primerNombre,
        person.segundoNombre || null,
        person.primerApellido,
        person.segundoApellido || null,
        person.email || null,
        person.celular || null,
        'WELCOME',
        'WELCOME',
        person.plataforma || null,
        effectiveContrato || null,
        personId,
      ]
    );
    academicCreated = true;
    console.log(`✅ [Approve] Registro ACADEMICA creado: ${academicId}`);
  } else {
    console.log(`ℹ️ [Approve] Registro ACADEMICA ya existía: ${academicId}`);
  }

  // Send WhatsApp welcome message
  let whatsappSent = false;
  let whatsappError: string | null = null;
  const celular = person.celular;
  console.log(`📱 [Approve] Celular: "${celular}" (${celular ? celular.length + ' chars' : 'null/undefined'})`);

  if (celular) {
    try {
      const nombre = person.primerNombre || '';
      const message = `Hola ${nombre} 👋:\n\n*¡Eres parte de Let's Go Speak!* 🎉 \n\nPara terminar tu registro y crear tu usuario sigue este enlace:\n\nhttps://talero.studio/nuevo-usuario/${academicId}\n\nSi tienes alguna pregunta, no dudes en contactarnos.\n\n¡Bienvenido a la familia LGS! 🚀`;
      console.log(`📤 [Approve] Enviando WhatsApp a: ${celular}`);
      const whatsappResult = await sendWhatsAppMessage(celular, message);
      whatsappSent = true;
      console.log(`✅ [Approve] WhatsApp enviado a ${celular}`, whatsappResult);
    } catch (err: any) {
      whatsappError = err.message;
      console.error(`⚠️ [Approve] Error enviando WhatsApp a "${celular}":`, err.message);
    }
  } else {
    whatsappError = 'Sin número de celular registrado';
    console.log(`ℹ️ [Approve] Sin celular, no se envió WhatsApp`);
  }

  return {
    personId,
    nombre: `${person.primerNombre} ${person.primerApellido}`,
    academicId,
    academicCreated,
    whatsappSent,
    whatsappError,
  };
}

/**
 * POST /api/postgres/people/[id]/approve
 *
 * Approve a person (titular or beneficiario). Replicates the full Wix approval flow:
 *
 * For BENEFICIARIO:
 *   1. Update PEOPLE.aprobacion = 'Aprobado' (+ copy contrato from titular)
 *   2. Create ACADEMICA record (nivel: WELCOME, step: WELCOME)
 *   3. Send WhatsApp welcome message
 *   4. Auto-approve titular if not already approved
 *
 * For TITULAR:
 *   1. Update PEOPLE.aprobacion = 'Aprobado'
 *   2. Create ACADEMICA record for titular
 *   3. Send WhatsApp to titular
 *   4. Auto-approve ALL pending beneficiaries (create ACADEMICA + send WhatsApp for each)
 */
export const POST = handlerWithAuth(async (
  _request: Request,
  { params }: { params: Record<string, string> }
) => {
  const personId = params.id;

  // Get person to determine type
  const person = await queryOne(
    `SELECT "_id", "tipoUsuario", "contrato", "aprobacion", "primerNombre", "primerApellido" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );
  if (!person) throw new NotFoundError('Person', personId);

  if (person.aprobacion === 'Aprobado') {
    throw new ConflictError('La persona ya está aprobada');
  }

  const contrato = person.contrato;

  // Approve the person themselves
  const mainResult = await approveOnePerson(personId, contrato);

  // ─── TITULAR: also approve all pending beneficiaries ───
  if (person.tipoUsuario === 'TITULAR' && contrato) {
    const pendingBeneficiaries = await queryMany(
      `SELECT "_id" FROM "PEOPLE"
       WHERE "contrato" = $1
         AND "tipoUsuario" = 'BENEFICIARIO'
         AND ("aprobacion" IS NULL OR "aprobacion" != 'Aprobado')`,
      [contrato]
    );

    console.log(`👥 [Approve] Titular aprobado. Beneficiarios pendientes encontrados: ${pendingBeneficiaries.length}`);
    console.log(`👥 [Approve] IDs de beneficiarios:`, pendingBeneficiaries.map((b: any) => b._id));

    const beneficiaryResults: ApproveResult[] = [];
    for (let i = 0; i < pendingBeneficiaries.length; i++) {
      const ben = pendingBeneficiaries[i];
      console.log(`👤 [Approve] Procesando beneficiario ${i + 1}/${pendingBeneficiaries.length}: ${ben._id}`);
      try {
        const result = await approveOnePerson(ben._id, contrato);
        console.log(`👤 [Approve] Beneficiario ${i + 1} resultado: aprobado=${result.academicCreated}, whatsapp=${result.whatsappSent}, error=${result.whatsappError}`);
        beneficiaryResults.push(result);
      } catch (err: any) {
        console.error(`⚠️ [Approve] Error aprobando beneficiario ${i + 1} (${ben._id}):`, err.message);
        beneficiaryResults.push({
          personId: ben._id,
          nombre: ben._id,
          academicId: null,
          academicCreated: false,
          whatsappSent: false,
          whatsappError: err.message,
        });
      }
    }
    console.log(`👥 [Approve] Resumen: ${beneficiaryResults.filter(r => r.whatsappSent).length}/${beneficiaryResults.length} WhatsApp enviados`);

    return successResponse({
      message: 'Titular y beneficiarios aprobados exitosamente',
      academicId: mainResult.academicId,
      academicCreated: mainResult.academicCreated,
      whatsappSent: mainResult.whatsappSent,
      whatsappError: mainResult.whatsappError,
      titularAutoApproved: false,
      // Beneficiaries approved as part of titular approval
      beneficiariesApproved: beneficiaryResults.map(r => ({
        personId: r.personId,
        nombre: r.nombre,
        academicCreated: r.academicCreated,
        whatsappSent: r.whatsappSent,
        whatsappError: r.whatsappError,
      })),
      beneficiariesCount: beneficiaryResults.length,
    });
  }

  // ─── BENEFICIARIO: auto-approve titular if not already approved ───
  let titularAutoApproved = false;
  if (person.tipoUsuario === 'BENEFICIARIO' && contrato) {
    const titular = await queryOne(
      `SELECT "_id", "aprobacion" FROM "PEOPLE"
       WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' LIMIT 1`,
      [contrato]
    );
    if (titular && titular.aprobacion !== 'Aprobado') {
      await query(
        `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "_updatedDate" = NOW() WHERE "_id" = $1`,
        [titular._id]
      );
      titularAutoApproved = true;
      console.log(`✅ [Approve] Titular auto-aprobado: ${titular._id}`);
    }
  }

  return successResponse({
    message: 'Persona aprobada exitosamente',
    academicId: mainResult.academicId,
    academicCreated: mainResult.academicCreated,
    whatsappSent: mainResult.whatsappSent,
    whatsappError: mainResult.whatsappError,
    titularAutoApproved,
  });
});
