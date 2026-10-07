import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { kidsIntake, validarSalonesDelPais } from '@/lib/kids-intake';
import { errorEdadCursoKids } from '@/lib/kids-mapping';
import { asegurarReservaKids, matricularKids } from '@/lib/kids-reserva';

/**
 * Estado y corrección de la matrícula KIDS de un beneficiario Kids.
 *
 * GET  → inscripción(es) en KIDS_INSCRIPCIONES (sin contraseña) + datos del niño.
 * POST { kidsData } → corrige campaña/curso/salón/apoderado de la inscripción que
 *       NO llegó a KIDS (o crea una si no existe), crea la reserva y, si el
 *       beneficiario ya está aprobado en LGS, la aprueba (queda matriculado).
 *       Es el arreglo para un kid cuya reserva KIDS rechazó (p. ej. edad vs curso).
 *       Una reserva que YA existe en KIDS no se cambia de salón desde aquí.
 */
export const GET = handlerWithStaffAuth(async (_req, { params }) => {
  const person = await queryOne<any>(
    `SELECT "_id","primerNombre","segundoNombre","primerApellido","segundoApellido","numeroId",
            "fechaNacimiento","email","celular","contrato","aprobacion","kids","plataforma"
       FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (!person) throw new NotFoundError('Person', params.id);
  const inscripciones = await queryMany<any>(
    `SELECT "_id","campaign","tipoCurso","horario","classroomId","salonNombre",
            "apoderado","apoderadoApellidos","apoderadoDoc","apoderadoTelefono","apoderadoMail","parentesco",
            "enviadoAKids","aprobado","aprobadoEnKids","kidsUsername","errorKids","_createdDate"
       FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = $1 ORDER BY "_createdDate" DESC`, [params.id]);
  return successResponse({ person, inscripciones, kidsConfigurado: kidsIntake.isConfigured() });
});

export const POST = handlerWithStaffAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.APROBAR);
  if (!kidsIntake.isConfigured()) throw new ValidationError('La integración con KIDS2026 no está configurada.');

  const { kidsData: kd } = await request.json();
  if (!kd?.classroomId || !kd?.tipoCurso) throw new ValidationError('Elija campaña, tipo de curso y salón.');

  const person = await queryOne<any>(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (!person) throw new NotFoundError('Person', params.id);
  if (person.kids !== true || person.tipoUsuario !== 'BENEFICIARIO') {
    throw new ValidationError('La persona no es un beneficiario Kids.');
  }

  const errEdad = errorEdadCursoKids(person.fechaNacimiento, kd.tipoCurso);
  if (errEdad) throw new ValidationError(errEdad);
  const titular = await queryOne<{ plataforma: string | null }>(
    `SELECT "plataforma" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' LIMIT 1`, [person.contrato]);
  const errPais = await validarSalonesDelPais(titular?.plataforma || person.plataforma,
    [{ classroomId: kd.classroomId, nombre: kd.salonNombre }]);
  if (errPais) throw new ValidationError(errPais);

  const inscs = await queryMany<any>(
    `SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = $1 ORDER BY "_createdDate" DESC`, [params.id]);
  if (inscs.some(i => i.aprobadoEnKids === true)) {
    throw new ValidationError('El niño ya está matriculado en KIDS. Un cambio de salón se hace en KIDS.');
  }
  let insc = inscs[0] || null;
  if (insc?.enviadoAKids === true && insc.classroomId !== kd.classroomId) {
    throw new ValidationError('La reserva ya existe en KIDS con otro salón: el cambio de salón se hace en KIDS.');
  }

  const valores = [
    kd.campaign || null, kd.tipoCurso, kd.horario || null, kd.classroomId, kd.salonNombre || null,
    kd.titularEsApoderado ? null : (kd.apoderado || null),
    kd.titularEsApoderado ? null : (kd.apoderadoApellidos || null),
    kd.titularEsApoderado ? null : (kd.apoderadoDoc || null),
    kd.titularEsApoderado ? null : (kd.apoderadoTelefono || null),
    kd.titularEsApoderado ? null : (kd.apoderadoMail || null),
    kd.parentesco || null,
  ];
  if (insc) {
    await query(
      `UPDATE "KIDS_INSCRIPCIONES"
          SET "campaign"=$2,"tipoCurso"=$3,"horario"=$4,"classroomId"=$5,"salonNombre"=$6,
              "apoderado"=$7,"apoderadoApellidos"=$8,"apoderadoDoc"=$9,"apoderadoTelefono"=$10,"apoderadoMail"=$11,
              "parentesco"=$12,"errorKids"=NULL,"_updatedDate"=NOW()
        WHERE "_id"=$1`, [insc._id, ...valores]);
  } else {
    const id = ids.kidsInscripcion();
    await query(
      `INSERT INTO "KIDS_INSCRIPCIONES"
         ("_id","contrato","beneficiarioId","numeroId","nombre","plataforma",
          "campaign","tipoCurso","horario","classroomId","salonNombre",
          "apoderado","apoderadoApellidos","apoderadoDoc","apoderadoTelefono","apoderadoMail","parentesco")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, person.contrato, person._id, person.numeroId,
       `${person.primerNombre || ''} ${person.primerApellido || ''}`.trim() || null,
       titular?.plataforma || person.plataforma || null, ...valores]);
    insc = { _id: id };
  }
  insc = await queryOne<any>(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "_id" = $1`, [insc._id]);

  // Beneficiario aún sin aprobar → solo queda RESERVADO (se matricula al aprobarlo).
  if (person.aprobacion !== 'Aprobado') {
    await asegurarReservaKids(insc, person);
    return successResponse({ estado: 'RESERVADO', mensaje: 'Cupo reservado en KIDS. Quedará matriculado al aprobar al beneficiario.' });
  }
  const cred = await matricularKids(insc, person);
  return successResponse({ estado: 'MATRICULADO', kidsCredenciales: [cred], mensaje: 'Matriculado en su curso en KIDS.' });
});
