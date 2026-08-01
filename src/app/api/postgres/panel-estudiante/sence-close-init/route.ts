import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { queryOne } from '@/lib/postgres';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { SENCE_CONFIG, getSenceActionUrl } from '@/lib/sence-config';
import { toSenceRutFormat } from '@/lib/rut-format';

/**
 * GET /api/postgres/panel-estudiante/sence-close-init?bookingId=<ACADEMICA_BOOKINGS._id>
 *
 * Arma los campos que el navegador debe enviar (vía POST directo, formulario
 * oculto) a sistemas.sence.cl para CERRAR la sesión SENCE de una clase ya
 * iniciada. Mismo esqueleto que sence-init/route.ts (login).
 */
export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);

  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get('bookingId');
  if (!bookingId) throw new ValidationError('El parámetro "bookingId" es requerido');

  const studentId = student.academicaId || student._id;

  const booking = await queryOne<{ _id: string }>(
    `SELECT "_id" FROM "ACADEMICA_BOOKINGS"
     WHERE "_id" = $1 AND ("idEstudiante" = $2 OR "studentId" = $2)`,
    [bookingId, studentId]
  );
  if (!booking) throw new NotFoundError('Booking', bookingId);

  if (!student.sence) {
    throw new ForbiddenError('Este proceso solo aplica a estudiantes SENCE');
  }

  const senceCode = (student as any).senceCode;
  if (!senceCode) {
    throw new ValidationError('Este estudiante SENCE no tiene código de curso (senceCode) configurado');
  }

  // TODO(SENCE-idSesionSence): leer de ACADEMICA_BOOKINGS.idSesionSence cuando
  // exista la columna (la agrega otro compañero, ver plan). El manual exige
  // reenviar el MISMO IdSesionSence que devolvió SENCE al iniciar sesión.
  // const row = await queryOne<{ idSesionSence: string }>(
  //   `SELECT "idSesionSence" FROM "ACADEMICA_BOOKINGS" WHERE "_id" = $1`,
  //   [bookingId]
  // );
  // const idSesionSence = row?.idSesionSence || '';
  const idSesionSence = '';

  const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';

  return successResponse({
    actionUrl: getSenceActionUrl('CerrarSesion'),
    fields: {
      RutOtec: SENCE_CONFIG.rutOtec,
      Token: SENCE_CONFIG.token,
      CodSence: SENCE_CONFIG.codSence,
      CodigoCurso: senceCode,
      LineaCapacitacion: SENCE_CONFIG.lineaCapacitacion,
      RunAlumno: toSenceRutFormat(student.numeroId),
      IdSesionAlumno: bookingId,
      IdSesionSence: idSesionSence,
      UrlRetoma: `${origin}/api/sence/cierre-retorno`,
      UrlError: `${origin}/api/sence/cierre-error`,
    },
  });
});
