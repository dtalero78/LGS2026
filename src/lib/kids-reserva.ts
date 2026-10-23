import 'server-only';
import { query, queryOne } from '@/lib/postgres';
import { kidsIntake } from '@/lib/kids-intake';
import { apoderadoParaKids, buildKidsReservation, plataformaToCountryCode, toISODate } from '@/lib/kids-mapping';
import { ValidationError } from '@/lib/errors';

const normDoc = (v: any) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Garantiza que la inscripción Kids (fila de KIDS_INSCRIPCIONES) tenga su
 * RESERVA creada en KIDS2026 y devuelve su externalRef (`contrato#numeroId`).
 *
 * - Si ya se envió (`enviadoAKids` + `kidsExternalRef`) no hace nada.
 * - Si no se envió (KIDS falló al agregar el beneficiario, o se agregó antes de
 *   que existiera el envío), la crea ahora con los datos guardados en LGS:
 *   PEOPLE (niño y titular) + KIDS_INSCRIPCIONES (salón, curso, apoderado).
 * - Si la reserva ya existe y está viva, KIDS responde 201 con sus ids (idempotente
 *   por externalRef). Cualquier error, incluido un 409, es un rechazo: se guarda en
 *   `errorKids` y NO se marca como enviada.
 *
 * Lanza Error con un mensaje legible si no se puede (sin salón, sin titular, KIDS caído).
 * Requiere la integración configurada (el caller lo verifica).
 */
export async function asegurarReservaKids(insc: any, beneficiario: any): Promise<string> {
  if (insc.enviadoAKids === true && insc.kidsExternalRef) return insc.kidsExternalRef;

  if (!insc.classroomId) {
    throw new Error('La inscripción Kids no tiene salón elegido: edite el beneficiario y elija campaña, curso y salón.');
  }
  const contrato = insc.contrato || beneficiario.contrato;
  if (!contrato) throw new Error('El beneficiario Kids no tiene contrato.');

  const titular = await queryOne<any>(
    `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
      ORDER BY "_createdDate" ASC LIMIT 1`, [contrato]);
  if (!titular) throw new Error(`No se encontró el titular del contrato ${contrato}.`);

  // "titularEsApoderado" no se guarda en KIDS_INSCRIPCIONES: se deduce del documento.
  // Una empresa nunca es apoderada (buildKidsReservation lo valida con mensaje claro).
  const esEmpresa = String(titular.tipoPersona || '').trim() === 'Empresa';
  const titularEsApoderado = !esEmpresa && (!insc.apoderadoDoc || normDoc(insc.apoderadoDoc) === normDoc(titular.numeroId));
  const externalRef = `${contrato}#${beneficiario.numeroId || insc.numeroId}`;

  let input: ReturnType<typeof buildKidsReservation>;
  try { input = buildKidsReservation({
    externalRef,
    countryCode: plataformaToCountryCode(titular.plataforma || beneficiario.plataforma),
    inicio: new Date().toISOString().slice(0, 10),
    finalContrato: toISODate(beneficiario.finalContrato || titular.finalContrato),
    titular,
    beneficiario,
    kidsData: {
      tipoCurso: insc.tipoCurso,
      classroomId: insc.classroomId,
      titularEsApoderado,
      apoderado: insc.apoderado,
      apoderadoApellidos: insc.apoderadoApellidos,
      apoderadoDoc: insc.apoderadoDoc,
      apoderadoTelefono: insc.apoderadoTelefono,
      apoderadoMail: insc.apoderadoMail,
      parentesco: insc.parentesco,
    },
  }); } catch (e: any) {
    // Datos que KIDS no aceptaría (p. ej. empresa como apoderada): se avisa claro.
    await query(`UPDATE "KIDS_INSCRIPCIONES" SET "errorKids"=$2, "_updatedDate"=NOW() WHERE "_id"=$1`,
      [insc._id, String(e?.message || 'error').slice(0, 500)]).catch(() => null);
    throw new ValidationError(String(e?.message || 'Datos Kids incompletos'));
  }

  let ref = externalRef;
  let contractId: string | null = null;
  let enrollmentId: string | null = null;
  try {
    const r = await kidsIntake.createReservation(input);
    ref = r.externalRef || externalRef;
    contractId = r.contractId || null;
    enrollmentId = r.enrollmentId || null;
  } catch (e: any) {
    // Un reintento de una reserva viva KIDS lo responde con 201 y sus ids, así que
    // CUALQUIER error —incluido el 409— es un rechazo real: reserva cancelada con esa
    // referencia, documento del niño en otro contrato, etc. Antes el 409 se tomaba como
    // "ya existe" y la inscripción quedaba "enviada" sin reserva en KIDS (03-11176-26).
    await query(`UPDATE "KIDS_INSCRIPCIONES" SET "errorKids"=$2, "_updatedDate"=NOW() WHERE "_id"=$1`,
      [insc._id, String(e?.message || 'error').slice(0, 500)]).catch(() => null);
    // ValidationError (400): la pantalla muestra el motivo real, no "Database error".
    throw new ValidationError(`KIDS no aceptó la reserva: ${e?.message || 'error desconocido'}`);
  }
  await query(
    `UPDATE "KIDS_INSCRIPCIONES"
        SET "enviadoAKids"=true, "kidsExternalRef"=$2,
            "kidsContractId"=COALESCE($3,"kidsContractId"), "kidsEnrollmentId"=COALESCE($4,"kidsEnrollmentId"),
            "fechaEnvioKids"=COALESCE("fechaEnvioKids", NOW()), "errorKids"=NULL, "_updatedDate"=NOW()
      WHERE "_id"=$1`,
    [insc._id, ref, contractId, enrollmentId]);
  return ref;
}

/**
 * Lleva a KIDS el apoderado guardado en la inscripción (tras "Modificar"). Misma
 * regla que la reserva (`apoderadoParaKids`). Devuelve si KIDS conservó los
 * nombres de una persona compartida. Lanza ValidationError legible si falla.
 */
export async function actualizarApoderadoKids(insc: any, beneficiario: any): Promise<{ nombresConservados: boolean }> {
  const ref = insc.kidsExternalRef;
  if (!ref) throw new ValidationError('El niño aún no tiene reserva en KIDS.');
  const contrato = insc.contrato || beneficiario.contrato;
  const titular = await queryOne<any>(
    `SELECT * FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR'
      ORDER BY "_createdDate" ASC LIMIT 1`, [contrato]);
  if (!titular) throw new ValidationError(`No se encontró el titular del contrato ${contrato}.`);
  let datos: ReturnType<typeof apoderadoParaKids>;
  try {
    datos = apoderadoParaKids(titular, {
      apoderado: insc.apoderado, apoderadoApellidos: insc.apoderadoApellidos, apoderadoDoc: insc.apoderadoDoc,
      apoderadoTelefono: insc.apoderadoTelefono, apoderadoMail: insc.apoderadoMail, parentesco: insc.parentesco,
      titularEsApoderado: !insc.apoderadoDoc,
    }, plataformaToCountryCode(titular.plataforma || beneficiario.plataforma));
  } catch (e: any) {
    throw new ValidationError(String(e?.message || 'Datos del apoderado incompletos'));
  }
  try {
    const r = await kidsIntake.updateGuardian(ref, datos);
    return { nombresConservados: r.nombresConservados === true };
  } catch (e: any) {
    throw new ValidationError(`KIDS no aceptó el cambio de apoderado: ${e?.message || 'error desconocido'}`);
  }
}

/**
 * `perfilEnviado`: si KIDS mandó al apoderado el enlace de creación de perfil
 * (null = ya tenía perfil o KIDS no lo informó); `perfilError`, por qué no.
 */
export interface KidsCredencialesLGS {
  numeroId: string; nombre: string; username: string | null; password: string | null;
  perfilEnviado: boolean | null; perfilError: string | null;
}

/**
 * Matricula al niño: asegura la reserva y la APRUEBA en KIDS (RESERVADA → ACTIVA,
 * queda en su curso/salón). Guarda credenciales en KIDS_INSCRIPCIONES y las devuelve.
 * Lanza Error legible si falla (y deja `errorKids` en la inscripción).
 */
export async function matricularKids(insc: any, beneficiario: any): Promise<KidsCredencialesLGS> {
  const ref = await asegurarReservaKids(insc, beneficiario);
  try {
    const r = await kidsIntake.approveReservation(ref);
    const cred = r.credenciales;
    await query(
      `UPDATE "KIDS_INSCRIPCIONES"
          SET "aprobado"=true, "fechaAprobado"=COALESCE("fechaAprobado", NOW()),
              "aprobadoEnKids"=true, "fechaAprobacionKids"=NOW(),
              "kidsUserId"=$2, "kidsUsername"=$3, "kidsPassword"=$4,
              "kidsEnrollmentId"=COALESCE($5,"kidsEnrollmentId"), "errorKids"=NULL, "_updatedDate"=NOW()
        WHERE "_id"=$1`,
      [insc._id, cred?.userId || null, cred?.username || null, cred?.passwordInicial || null, r.enrollmentId || null]);
    return {
      numeroId: insc.numeroId, nombre: insc.nombre, username: cred?.username || null, password: cred?.passwordInicial || null,
      perfilEnviado: r.perfil ? r.perfil.enviado : null,
      perfilError: r.perfil && !r.perfil.enviado ? (r.perfil.error || 'error desconocido') : null,
    };
  } catch (e: any) {
    await query(`UPDATE "KIDS_INSCRIPCIONES" SET "errorKids"=$2, "_updatedDate"=NOW() WHERE "_id"=$1`,
      [insc._id, String(e?.message || 'error').slice(0, 500)]).catch(() => null);
    throw new ValidationError(`KIDS no aprobó la matrícula: ${e?.message || 'error desconocido'}`);
  }
}
