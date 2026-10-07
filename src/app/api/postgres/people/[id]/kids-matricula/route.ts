import 'server-only';
import { handlerWithStaffAuth, successResponse } from '@/lib/api-helpers';
import { requirePermission, hasPermission } from '@/lib/api-permissions';
import { PersonPermission } from '@/types/permissions';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';
import { kidsIntake, validarSalonesDelPais } from '@/lib/kids-intake';
import { errorEdadCursoKids } from '@/lib/kids-mapping';
import { asegurarReservaKids, matricularKids } from '@/lib/kids-reserva';

/**
 * Estado, corrección y edición de la inscripción KIDS de un beneficiario Kids.
 *
 * GET   → inscripción(es) en KIDS_INSCRIPCIONES (sin contraseña) + datos del niño.
 * POST  { kidsData } → "Reservar / Matricular en KIDS" (permiso APROBAR): corrige
 *       curso/salón de la inscripción que NO llegó a KIDS, crea la reserva y, si ya
 *       está aprobado, la activa. Errores de KIDS → 4xx.
 * PATCH { kidsData } → "Modificar" un kid (permiso MODIFICAR): guarda curso/salón
 *       (solo si aún no está en KIDS) + apoderado/parentesco, e intenta la reserva
 *       (y la matrícula si está aprobado y quien edita puede aprobar). Un error de
 *       KIDS no deshace lo guardado: se devuelve en `kidsError`.
 * Una reserva que YA existe en KIDS no se cambia de salón desde LGS.
 */
export const GET = handlerWithStaffAuth(async (_req, { params }) => {
  const person = await queryOne<any>(
    `SELECT "_id","primerNombre","segundoNombre","primerApellido","segundoApellido","numeroId",
            "fechaNacimiento","email","celular","domicilio","contrato","aprobacion","kids","plataforma"
       FROM "PEOPLE" WHERE "_id" = $1`, [params.id]);
  if (!person) throw new NotFoundError('Person', params.id);
  const inscripciones = await queryMany<any>(
    `SELECT "_id","campaign","tipoCurso","horario","classroomId","salonNombre",
            "apoderado","apoderadoApellidos","apoderadoDoc","apoderadoTelefono","apoderadoMail","parentesco",
            "enviadoAKids","aprobado","aprobadoEnKids","kidsUsername","errorKids","_createdDate"
       FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = $1 ORDER BY "_createdDate" DESC`, [params.id]);
  return successResponse({ person, inscripciones, kidsConfigurado: kidsIntake.isConfigured() });
});

async function cargarKid(id: string) {
  const person = await queryOne<any>(`SELECT * FROM "PEOPLE" WHERE "_id" = $1`, [id]);
  if (!person) throw new NotFoundError('Person', id);
  if (person.kids !== true || person.tipoUsuario !== 'BENEFICIARIO') {
    throw new ValidationError('La persona no es un beneficiario Kids.');
  }
  const titular = await queryOne<{ plataforma: string | null }>(
    `SELECT "plataforma" FROM "PEOPLE" WHERE "contrato" = $1 AND "tipoUsuario" = 'TITULAR' LIMIT 1`, [person.contrato]);
  const inscs = await queryMany<any>(
    `SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "beneficiarioId" = $1 ORDER BY "_createdDate" DESC`, [id]);
  return { person, plataforma: titular?.plataforma || person.plataforma || null, insc: inscs[0] || null };
}

/** Valida edad y país del curso/salón elegido (misma regla que KIDS). */
async function validarCurso(person: any, plataforma: string | null, kd: any) {
  const errEdad = errorEdadCursoKids(person.fechaNacimiento, kd.tipoCurso);
  if (errEdad) throw new ValidationError(errEdad);
  const errPais = await validarSalonesDelPais(plataforma, [{ classroomId: kd.classroomId, nombre: kd.salonNombre }]);
  if (errPais) throw new ValidationError(errPais);
}

/**
 * Guarda la inscripción (UPDATE de la existente o INSERT si no hay).
 * `conCurso=false` → solo apoderado/parentesco (la reserva ya está en KIDS).
 */
async function guardarInscripcion(person: any, plataforma: string | null, insc: any | null, kd: any, conCurso: boolean) {
  const apoderado = [
    kd.apoderado || null, kd.apoderadoApellidos || null, kd.apoderadoDoc || null,
    kd.apoderadoTelefono || null, kd.apoderadoMail || null, kd.parentesco || null,
  ];
  if (insc && !conCurso) {
    await query(
      `UPDATE "KIDS_INSCRIPCIONES"
          SET "apoderado"=$2,"apoderadoApellidos"=$3,"apoderadoDoc"=$4,"apoderadoTelefono"=$5,
              "apoderadoMail"=$6,"parentesco"=$7,"_updatedDate"=NOW()
        WHERE "_id"=$1`, [insc._id, ...apoderado]);
    return insc._id as string;
  }
  const curso = [kd.campaign || null, kd.tipoCurso || null, kd.horario || null, kd.classroomId || null, kd.salonNombre || null];
  if (insc) {
    await query(
      `UPDATE "KIDS_INSCRIPCIONES"
          SET "campaign"=$2,"tipoCurso"=$3,"horario"=$4,"classroomId"=$5,"salonNombre"=$6,
              "apoderado"=$7,"apoderadoApellidos"=$8,"apoderadoDoc"=$9,"apoderadoTelefono"=$10,"apoderadoMail"=$11,
              "parentesco"=$12,"errorKids"=NULL,"_updatedDate"=NOW()
        WHERE "_id"=$1`, [insc._id, ...curso, ...apoderado]);
    return insc._id as string;
  }
  const id = ids.kidsInscripcion();
  await query(
    `INSERT INTO "KIDS_INSCRIPCIONES"
       ("_id","contrato","beneficiarioId","numeroId","nombre","plataforma",
        "campaign","tipoCurso","horario","classroomId","salonNombre",
        "apoderado","apoderadoApellidos","apoderadoDoc","apoderadoTelefono","apoderadoMail","parentesco")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [id, person.contrato, person._id, person.numeroId,
     `${person.primerNombre || ''} ${person.primerApellido || ''}`.trim() || null,
     plataforma, ...curso, ...apoderado]);
  return id;
}

export const POST = handlerWithStaffAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.APROBAR);
  if (!kidsIntake.isConfigured()) throw new ValidationError('La integración con KIDS2026 no está configurada.');

  const { kidsData: kd } = await request.json();
  if (!kd?.classroomId || !kd?.tipoCurso) throw new ValidationError('Elija campaña, tipo de curso y salón.');

  const { person, plataforma, insc } = await cargarKid(params.id);
  await validarCurso(person, plataforma, kd);
  if (insc?.aprobadoEnKids === true) {
    throw new ValidationError('El niño ya está matriculado en KIDS. Un cambio de salón se hace en KIDS.');
  }
  if (insc?.enviadoAKids === true && insc.classroomId !== kd.classroomId) {
    throw new ValidationError('La reserva ya existe en KIDS con otro salón: el cambio de salón se hace en KIDS.');
  }

  const inscId = await guardarInscripcion(person, plataforma, insc, kd, true);
  const fila = await queryOne<any>(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "_id" = $1`, [inscId]);

  // Beneficiario aún sin aprobar → solo queda RESERVADO (se matricula al aprobarlo).
  if (person.aprobacion !== 'Aprobado') {
    await asegurarReservaKids(fila, person);
    return successResponse({ estado: 'RESERVADO', mensaje: 'Cupo reservado en KIDS. Quedará matriculado al aprobar al beneficiario.' });
  }
  const cred = await matricularKids(fila, person);
  return successResponse({ estado: 'MATRICULADO', kidsCredenciales: [cred], mensaje: 'Matriculado en su curso en KIDS.' });
});

export const PATCH = handlerWithStaffAuth(async (request, { params }, session) => {
  await requirePermission(session, PersonPermission.MODIFICAR);
  const { kidsData: kd } = await request.json();
  if (!kd) throw new ValidationError('Faltan los datos Kids.');

  const { person, plataforma, insc } = await cargarKid(params.id);
  const enKids = insc?.enviadoAKids === true || insc?.aprobadoEnKids === true;

  // Ya está en KIDS: el curso/salón no se toca desde LGS; solo apoderado/parentesco.
  if (enKids) {
    await guardarInscripcion(person, plataforma, insc, kd, false);
    return successResponse({ estado: insc.aprobadoEnKids ? 'MATRICULADO' : 'RESERVADO', mensaje: 'Datos del apoderado actualizados en LGS.' });
  }

  const configurado = kidsIntake.isConfigured();
  if (configurado && (!kd.classroomId || !kd.tipoCurso)) throw new ValidationError('Elija campaña, tipo de curso y salón.');
  if (kd.classroomId && kd.tipoCurso) await validarCurso(person, plataforma, kd);

  const inscId = await guardarInscripcion(person, plataforma, insc, kd, true);
  if (!configurado || !kd.classroomId) return successResponse({ estado: 'GUARDADO', mensaje: 'Datos Kids guardados en LGS.' });

  // Mismo efecto que al agregar/aprobar: reserva; y matrícula si ya está aprobado
  // (solo si quien edita también puede aprobar).
  const fila = await queryOne<any>(`SELECT * FROM "KIDS_INSCRIPCIONES" WHERE "_id" = $1`, [inscId]);
  try {
    if (person.aprobacion === 'Aprobado' && await hasPermission(session, PersonPermission.APROBAR)) {
      const cred = await matricularKids(fila, person);
      return successResponse({ estado: 'MATRICULADO', kidsCredenciales: [cred], mensaje: 'Matriculado en su curso en KIDS.' });
    }
    await asegurarReservaKids(fila, person);
    return successResponse({
      estado: 'RESERVADO',
      mensaje: person.aprobacion === 'Aprobado'
        ? 'Cupo reservado en KIDS. Falta matricularlo (botón "Matricular en KIDS", requiere permiso de aprobar).'
        : 'Cupo reservado en KIDS. Quedará matriculado al aprobar al beneficiario.',
    });
  } catch (e: any) {
    return successResponse({ estado: 'ERROR', kidsError: String(e?.message || 'error'), mensaje: 'Datos guardados en LGS, pero KIDS no los aceptó.' });
  }
});
