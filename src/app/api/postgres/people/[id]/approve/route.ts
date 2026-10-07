import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ConflictError } from '@/lib/errors';
import { assertNoEsContratoPrueba } from '@/lib/contrato-prueba-guard';
import { ids } from '@/lib/id-generator';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { kidsIntake } from '@/lib/kids-intake';
import { asegurarReservaKids } from '@/lib/kids-reserva';
import { registrarCambioAprobacion, nombreDe, type OrigenAprobacion } from '@/lib/aprobacion-audit';

interface KidsCredenciales { numeroId: string; nombre: string; username: string | null; password: string | null }
interface ApproveResult {
  personId: string;
  nombre: string;
  academicId: string | null;
  academicCreated: boolean;
  whatsappSent: boolean;
  whatsappError: string | null;
  kidsCredenciales?: KidsCredenciales[];
  /** Fallos al matricular en KIDS2026 (el kid queda aprobado en LGS igual). */
  kidsErrores?: string[];
}

/**
 * Approve a single person: update PEOPLE, create ACADEMICA, send WhatsApp.
 * Reusable for both titular and beneficiario approval.
 * @param inicioContrato - titular's consent date to copy to beneficiarios (null = skip)
 */
async function approveOnePerson(
  personId: string,
  contrato: string | null,
  inicioContrato: string | null = null,
  audit: { session: any; origen: OrigenAprobacion } | null = null
): Promise<ApproveResult> {
  const person = await queryOne(
    `SELECT * FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );
  if (!person) throw new NotFoundError('Person', personId);

  // Skip if already approved
  if (person.aprobacion === 'Aprobado') {
    console.log(`ℹ️ [Approve] ${person.primerNombre} ya está aprobado, saltando`);
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

  // Beneficiario Kids: su programa es KIDS2026, NO el de adultos de LGS. Por eso
  // NO se le crea ficha ACADEMICA ni se le envía el WhatsApp de auto-registro de
  // LGS (ese mensaje lo maneja el flujo KIDS2026). Sí queda aprobado en PEOPLE
  // (aprobacion/estado/fechaIngreso) y sigue el paso de aprobación de la reserva
  // Kids más abajo.
  const esKids = person.kids === true;

  // Update PEOPLE.aprobacion = 'Aprobado' + estado = 'ACTIVA'.
  // El mapeo aprobacion→estado está documentado en /api/postgres/approvals/[id]
  // (APROBACION_TO_ESTADO); aquí lo aplicamos para que ambos endpoints dejen el
  // titular/beneficiario en estado consistente. Antes este route sólo tocaba
  // aprobacion y dejaba `estado` en NULL — el badge "Estado: Null" aparecía
  // en /person/[id] aunque el contrato estuviera aprobado.
  // Para BENEFICIARIO además copia `contrato` (si falta) y `inicioContrato` del titular.
  if (person.tipoUsuario === 'BENEFICIARIO') {
    const extraFields = [];
    const extraValues: any[] = [];

    if (effectiveContrato && !person.contrato) {
      extraFields.push(`"contrato" = $${extraValues.length + 2}`);
      extraValues.push(effectiveContrato);
    }
    if (inicioContrato) {
      extraFields.push(`"inicioContrato" = $${extraValues.length + 2}`);
      extraValues.push(inicioContrato);
    }

    const setClause = extraFields.length > 0 ? `, ${extraFields.join(', ')}` : '';
    // Al aprobar se sella la fecha de ingreso con el día de hoy (titular y
    // beneficiarios). No pisa el valor si ya estaba aprobado: este UPDATE solo
    // corre en la primera aprobación (el skip de arriba lo garantiza).
    await query(
      `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "estado" = 'ACTIVA', "fechaIngreso" = NOW()${setClause}, "_updatedDate" = NOW() WHERE "_id" = $1`,
      [personId, ...extraValues]
    );
  } else {
    await query(
      `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "estado" = 'ACTIVA', "fechaIngreso" = NOW(), "_updatedDate" = NOW() WHERE "_id" = $1`,
      [personId]
    );
  }
  console.log(`✅ [Approve] PEOPLE.aprobacion='Aprobado' + estado='ACTIVA'`);

  if (audit) {
    await registrarCambioAprobacion({
      personId,
      contrato: contrato || person.contrato,
      tipoUsuario: person.tipoUsuario,
      nombre: nombreDe(person),
      estadoAnterior: person.aprobacion,
      estadoNuevo: 'Aprobado',
      origen: audit.origen,
      session: audit.session,
    });
  }

  // Check/Create ACADEMICA record — SÓLO para BENEFICIARIO.
  // Los TITULARES no son estudiantes (no toman clases); su rol es contractual.
  // Crear ACADEMICA para un titular que NO es beneficiario produce un registro
  // espurio que aparece como "estudiante" en búsquedas, paneles y reports.
  // Si el titular ES también beneficiario (titularEsBeneficiario), existe una fila
  // PEOPLE separada con tipoUsuario='BENEFICIARIO' que sí dispara ACADEMICA.
  let academicId: string | null = null;
  let academicCreated = false;

  if (person.tipoUsuario === 'BENEFICIARIO' && !esKids) {
    const existingAcademic = await queryOne(
      `SELECT "_id" FROM "ACADEMICA" WHERE "numeroId" = $1 LIMIT 1`,
      [person.numeroId]
    );

    academicId = existingAcademic?._id ?? null;

    if (!existingAcademic) {
      academicId = ids.academic();
      await query(
        `INSERT INTO "ACADEMICA" (
          "_id", "numeroId", "primerNombre", "segundoNombre",
          "primerApellido", "segundoApellido", "email", "celular",
          "nivel", "step", "plataforma", "estadoInactivo",
          "contrato", "usuarioId", "sence", "senceCode",
          "_createdDate", "_updatedDate"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, $13, $14, $15, NOW(), NOW()
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
          person.sence === true, // propaga la marca SENCE del PEOPLE a la ficha
          person.senceCode || null, // y su código SENCE
        ]
      );
      academicCreated = true;
      console.log(`✅ [Approve] Registro ACADEMICA creado: ${academicId}`);
    } else {
      console.log(`ℹ️ [Approve] Registro ACADEMICA ya existía: ${academicId}`);
      // Re-matrícula (2026-10-06): la ficha viene de un contrato anterior. Se liga a
      // ESTE beneficiario/contrato y se reactiva (mismo criterio que Crear Contrato:
      // el historial sigue con el alumno), salvo que pertenezca a un beneficiario
      // VIVO de otro contrato — en ese caso no se toca.
      const acad = await queryOne<{ usuarioId: string | null }>(
        `SELECT "usuarioId" FROM "ACADEMICA" WHERE "_id" = $1`, [academicId]);
      const duenoVivo = acad?.usuarioId && acad.usuarioId !== personId
        ? await queryOne(
            `SELECT 1 FROM "PEOPLE"
              WHERE "_id" = $1 AND "tipoUsuario" <> 'TITULAR' AND "contrato" IS DISTINCT FROM $2
                AND UPPER(COALESCE("estado",'')) NOT IN ('FINALIZADA','ANULADO','RETRACTADO')
                AND UPPER(COALESCE("aprobacion",'')) NOT IN ('CONTRATO NULO','DEVUELTO','RECHAZADO','RETRACTADO')
                AND ("estadoInactivo" IS NOT TRUE OR "fechaOnHold" IS NOT NULL)`,
            [acad.usuarioId, effectiveContrato])
        : null;
      if (!duenoVivo) {
        await query(
          `UPDATE "ACADEMICA" SET "usuarioId" = $2, "contrato" = COALESCE($3, "contrato"),
                  "estadoInactivo" = false, "_updatedDate" = NOW()
            WHERE "_id" = $1`,
          [academicId, personId, effectiveContrato || null]);
        if (person.email) {
          await query(
            `UPDATE "USUARIOS_ROLES" SET "activo" = true, "contrato" = COALESCE($2, "contrato")
              WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) AND UPPER(COALESCE("rol",'')) = 'ESTUDIANTE'`,
            [person.email, effectiveContrato || null]);
        }
        console.log(`🔁 [Approve] Ficha ACADEMICA re-ligada al contrato ${effectiveContrato} (re-matrícula)`);
      }
    }
  } else if (esKids) {
    console.log(`ℹ️ [Approve] Beneficiario KIDS — se omite ACADEMICA (su programa es KIDS2026, no el de adultos)`);
  } else {
    console.log(`ℹ️ [Approve] ${person.tipoUsuario} — se omite creación de ACADEMICA (sólo beneficiarios necesitan registro académico)`);
  }

  // Send WhatsApp welcome message — SÓLO a BENEFICIARIOS.
  // El mensaje contiene un link de auto-registro (/nuevo-usuario/{academicId})
  // que sólo aplica a estudiantes. Para TITULARES el academicId es null y el
  // link saldría roto; además los titulares no son usuarios de la plataforma.
  let whatsappSent = false;
  let whatsappError: string | null = null;

  if (person.tipoUsuario !== 'BENEFICIARIO') {
    whatsappError = 'Omitido — los titulares no reciben mensaje de auto-registro';
    console.log(`ℹ️ [Approve] ${person.tipoUsuario} — se omite WhatsApp de bienvenida`);
  } else if (esKids) {
    whatsappError = 'Omitido — beneficiario KIDS (el WhatsApp lo maneja el flujo KIDS2026)';
    console.log(`ℹ️ [Approve] Beneficiario KIDS — se omite WhatsApp de LGS`);
  } else {
    const celular = person.celular;
    console.log(`📱 [Approve] Celular: "${celular}" (${celular ? celular.length + ' chars' : 'null/undefined'})`);

    if (celular) {
      try {
        const nombre = person.primerNombre || '';
        const message = `Hola ${nombre} 👋:\n\n*¡Eres parte de Let's Go Speak!* 🎉 \n\nPara terminar tu registro y crear tu usuario sigue este enlace:\n\nhttps://lgs-plataforma.com/nuevo-usuario/${academicId}\n\nSi tienes alguna pregunta, no dudes en contactarnos.\n\n¡Bienvenido a la familia LGS! 🚀`;
        console.log(`📤 [Approve] Enviando WhatsApp a: ${celular}`);
        const whatsappResult = await sendWhatsAppMessage(celular, message, 'bienvenida_aprobar');
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
  }

  // Aprobar la(s) reserva(s) Kids en KIDS2026 (best-effort). Al aprobar el
  // beneficiario en LGS activa su matrícula allá (RESERVADA→ACTIVA) y guarda las
  // credenciales del alumno (para mostrarlas/entregarlas al apoderado).
  const kidsCredenciales: KidsCredenciales[] = [];
  // Beneficiario Kids: marca su(s) inscripción(es) en KIDS_INSCRIPCIONES como
  // APROBADA(S) en LGS — siempre, haya o no integración con KIDS2026. Es la
  // constancia local de que el kid quedó aprobado; el flujo KIDS2026 la usará
  // (y enviará su propio WhatsApp).
  if (person.tipoUsuario === 'BENEFICIARIO' && esKids) {
    try {
      await query(
        `UPDATE "KIDS_INSCRIPCIONES" SET "aprobado"=true, "fechaAprobado"=NOW(), "_updatedDate"=NOW()
           WHERE "beneficiarioId"=$1`,
        [personId]
      );
      console.log(`✅ [Approve] KIDS_INSCRIPCIONES marcada como aprobada para ${personId}`);
    } catch (e: any) {
      console.error('[approve] Error marcando KIDS_INSCRIPCIONES.aprobado (best-effort):', e?.message);
    }
  }
  // Si la integración KIDS2026 está activa, además aprueba la reserva allá
  // (RESERVADA→ACTIVA, el niño queda en su curso/salón) y guarda las credenciales.
  // Mismo proceso para el kid de Crear Contrato y el agregado desde la ficha. Si la
  // reserva nunca llegó a KIDS (falló al agregarlo), se crea AHORA antes de aprobarla
  // — antes se omitía en silencio y el niño quedaba aprobado en LGS sin curso en KIDS.
  const kidsErrores: string[] = [];
  if (person.tipoUsuario === 'BENEFICIARIO' && esKids && kidsIntake.isConfigured()) {
    try {
      const inscs = await queryMany<any>(
        `SELECT * FROM "KIDS_INSCRIPCIONES"
          WHERE "beneficiarioId" = $1 AND "aprobadoEnKids" IS NOT TRUE`,
        [personId]
      );
      if (inscs.length === 0) {
        const yaAprobada = await queryOne(
          `SELECT 1 FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = $1 AND "aprobadoEnKids" = true LIMIT 1`, [personId]);
        if (!yaAprobada) kidsErrores.push('No tiene inscripción Kids (campaña/curso/salón): no se pudo matricular en KIDS.')
      }
      for (const insc of inscs) {
        try {
          const ref = await asegurarReservaKids(insc, person);
          const r = await kidsIntake.approveReservation(ref);
          const cred = r.credenciales;
          await query(
            `UPDATE "KIDS_INSCRIPCIONES"
               SET "aprobadoEnKids"=true, "fechaAprobacionKids"=NOW(),
                   "kidsUserId"=$2, "kidsUsername"=$3, "kidsPassword"=$4,
                   "kidsEnrollmentId"=COALESCE($5,"kidsEnrollmentId"), "errorKids"=NULL, "_updatedDate"=NOW()
             WHERE "_id"=$1`,
            [insc._id, cred?.userId || null, cred?.username || null, cred?.passwordInicial || null, r.enrollmentId || null]
          );
          kidsCredenciales.push({
            numeroId: insc.numeroId, nombre: insc.nombre,
            username: cred?.username || null, password: cred?.passwordInicial || null,
          });
        } catch (e: any) {
          console.error('[approve] Error aprobando reserva Kids (best-effort):', e?.message);
          kidsErrores.push(String(e?.message || 'error desconocido'));
          try { await query(`UPDATE "KIDS_INSCRIPCIONES" SET "errorKids"=$2, "_updatedDate"=NOW() WHERE "_id"=$1`, [insc._id, String(e?.message || 'error').slice(0, 500)]); } catch { /* noop */ }
        }
      }
    } catch (e: any) {
      console.error('[approve] Error consultando KIDS_INSCRIPCIONES (best-effort):', e?.message);
      kidsErrores.push(`No se pudo consultar la inscripción Kids: ${e?.message || 'error'}`);
    }
  }

  return {
    personId,
    nombre: `${person.primerNombre} ${person.primerApellido}`,
    academicId,
    academicCreated,
    whatsappSent,
    whatsappError,
    kidsCredenciales: kidsCredenciales.length ? kidsCredenciales : undefined,
    kidsErrores: kidsErrores.length ? kidsErrores : undefined,
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
  { params }: { params: Record<string, string> },
  session
) => {
  const personId = params.id;

  // Get person to determine type (include inicioContrato for propagation to beneficiarios)
  const person = await queryOne(
    `SELECT "_id", "tipoUsuario", "contrato", "aprobacion", "primerNombre", "primerApellido", "inicioContrato" FROM "PEOPLE" WHERE "_id" = $1`,
    [personId]
  );
  if (!person) throw new NotFoundError('Person', personId);

  // Contratos de prueba (PRB-): NADIE puede aprobarlos (tampoco SUPER_ADMIN).
  // Aprobar dispara efectos reales (WhatsApp al celular del registro,
  // fechaIngreso, creación de ACADEMICA para los beneficiarios, etc.).
  assertNoEsContratoPrueba(person.contrato, 'aprobar el contrato');

  if (person.aprobacion === 'Aprobado') {
    throw new ConflictError('La persona ya está aprobada');
  }

  const contrato = person.contrato;

  // Approve the person themselves
  const mainResult = await approveOnePerson(personId, contrato, null, { session, origen: 'APROBAR' });

  // ─── TITULAR: also approve all pending beneficiaries ───
  if (person.tipoUsuario === 'TITULAR' && contrato) {
    const pendingBeneficiaries = await queryMany(
      `SELECT "_id" FROM "PEOPLE"
       WHERE "contrato" = $1
         AND "tipoUsuario" = 'BENEFICIARIO'
         AND ("aprobacion" IS NULL OR "aprobacion" != 'Aprobado')`,
      [contrato]
    );

    const titularInicioContrato = person.inicioContrato || null;
    console.log(`👥 [Approve] Titular aprobado. Beneficiarios pendientes encontrados: ${pendingBeneficiaries.length}. inicioContrato a propagar: ${titularInicioContrato}`);
    console.log(`👥 [Approve] IDs de beneficiarios:`, pendingBeneficiaries.map((b: any) => b._id));

    const beneficiaryResults: ApproveResult[] = [];
    for (let i = 0; i < pendingBeneficiaries.length; i++) {
      const ben = pendingBeneficiaries[i];
      console.log(`👤 [Approve] Procesando beneficiario ${i + 1}/${pendingBeneficiaries.length}: ${ben._id}`);
      try {
        const result = await approveOnePerson(ben._id, contrato, titularInicioContrato, { session, origen: 'APROBAR_CASCADA' });
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

    // Reversa de "Aprobado → Pendiente": ese flujo bloquea el login de los
    // beneficiarios (USUARIOS_ROLES.activo=false) SIN tocar su `aprobacion`.
    // Al re-aprobar el titular, los beneficiarios ya están 'Aprobado' → el loop
    // de arriba no los procesa. Reactivamos su login explícitamente aquí.
    try {
      const react = await query(
        `UPDATE "USUARIOS_ROLES" SET "activo" = true
           WHERE LOWER("email") IN (
             SELECT LOWER("email") FROM "PEOPLE"
             WHERE "contrato" = $1 AND "tipoUsuario" = 'BENEFICIARIO' AND "email" IS NOT NULL
           )`,
        [contrato]
      );
      console.log(`🔓 [Approve] Login reactivado de ${react.rowCount || 0} beneficiario(s)`);
    } catch (err: any) {
      console.error('⚠️ [Approve] No se pudo reactivar login de beneficiarios:', err.message);
    }

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
        kidsCredenciales: r.kidsCredenciales,
        kidsErrores: r.kidsErrores,
      })),
      beneficiariesCount: beneficiaryResults.length,
    });
  }

  // ─── BENEFICIARIO: copy inicioContrato from titular + auto-approve titular if pending ───
  let titularAutoApproved = false;
  if (person.tipoUsuario === 'BENEFICIARIO' && contrato) {
    const titular = await queryOne(
      `SELECT "_id", "aprobacion", "inicioContrato" FROM "PEOPLE"
       WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' LIMIT 1`,
      [contrato]
    );

    if (titular) {
      // Propagate inicioContrato from titular to this beneficiario
      if (titular.inicioContrato && !mainResult.whatsappError?.includes('Ya estaba aprobado')) {
        await query(
          `UPDATE "PEOPLE" SET "inicioContrato" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`,
          [titular.inicioContrato, personId]
        );
        console.log(`✅ [Approve] inicioContrato propagado al beneficiario: ${titular.inicioContrato}`);
      }

      // Auto-approve titular if still pending (también sella su fechaIngreso hoy)
      if (titular.aprobacion !== 'Aprobado') {
        await query(
          `UPDATE "PEOPLE" SET "aprobacion" = 'Aprobado', "fechaIngreso" = NOW(), "_updatedDate" = NOW() WHERE "_id" = $1`,
          [titular._id]
        );
        titularAutoApproved = true;
        console.log(`✅ [Approve] Titular auto-aprobado: ${titular._id}`);
        await registrarCambioAprobacion({
          personId: titular._id,
          contrato,
          tipoUsuario: 'TITULAR',
          estadoAnterior: titular.aprobacion,
          estadoNuevo: 'Aprobado',
          origen: 'APROBAR_CASCADA',
          motivo: 'Titular auto-aprobado al aprobar un beneficiario',
          session,
        });
      }
    }
  }

  return successResponse({
    message: 'Persona aprobada exitosamente',
    academicId: mainResult.academicId,
    academicCreated: mainResult.academicCreated,
    whatsappSent: mainResult.whatsappSent,
    whatsappError: mainResult.whatsappError,
    titularAutoApproved,
    esKids: mainResult.kidsCredenciales !== undefined || mainResult.kidsErrores !== undefined,
    kidsCredenciales: mainResult.kidsCredenciales,
    kidsErrores: mainResult.kidsErrores,
  });
});
