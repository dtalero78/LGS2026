import 'server-only';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { resolveStudentFromSession } from '@/services/panel-estudiante.service';
import { queryOne } from '@/lib/postgres';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { getSenceConfig, getSenceActionUrl } from '@/lib/sence-config';
import { toSenceRutFormat } from '@/lib/rut-format';

/**
 * GET /api/postgres/panel-estudiante/sence-init?bookingId=<ACADEMICA_BOOKINGS._id>
 *
 * Arma los campos que el navegador debe enviar (vía POST directo, formulario
 * oculto) a sistemas.sence.cl para iniciar sesión SENCE antes de la clase.
 * Solo aplica a estudiantes marcados sence=true.
 */
export const GET = handlerWithAuth(async (request, context, session) => {
  const student = await resolveStudentFromSession(session);

  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get('bookingId');
  if (!bookingId) throw new ValidationError('El parámetro "bookingId" es requerido');

  const studentId = student.academicaId || student._id;

  const booking = await queryOne<{ _id: string; eventStart: Date }>(
    `SELECT b."_id",
            COALESCE(c."dia", b."fechaEvento") AS "eventStart"
     FROM "ACADEMICA_BOOKINGS" b
     LEFT JOIN "CALENDARIO" c ON (c."_id" = b."eventoId" OR c."_id" = b."idEvento")
     WHERE b."_id" = $1 AND (b."idEstudiante" = $2 OR b."studentId" = $2)`,
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

  // Solo se puede iniciar sesión SENCE dentro de la misma ventana en que el
  // enlace de Zoom está disponible en el panel (-5 min / +10 min respecto al
  // inicio del evento) — ver `showZoom` en panel-estudiante/page.tsx.
  const eventStart = new Date(booking.eventStart).getTime();
  const now = Date.now();
  const minutesUntil = (eventStart - now) / 60000;
  const minutesSince = (now - eventStart) / 60000;
  if (minutesUntil > 5 || minutesSince > 10) {
    throw new ValidationError(
      'Aún no puedes iniciar sesión en SENCE. El enlace se habilita 5 minutos antes de tu clase.'
    );
  }

  const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';
  const senceConfig = getSenceConfig();
  const actionUrl = getSenceActionUrl('IniciarSesion');
  const fields = {
    RutOtec: senceConfig.rutOtec,
    Token: senceConfig.token,
    CodSence: senceConfig.codSence,
    CodigoCurso: senceCode,
    LineaCapacitacion: senceConfig.lineaCapacitacion,
    RunAlumno: toSenceRutFormat(student.numeroId),
    IdSesionAlumno: bookingId,
    UrlRetoma: `${origin}/api/sence/retorno`,
    UrlError: `${origin}/api/sence/error`,
  };

  console.log('📤 [SENCE] IniciarSesion — actionUrl:', actionUrl);
  console.log('📤 [SENCE] IniciarSesion — fields:', {
    ...fields,
    Token: fields.Token ? `${fields.Token.slice(0, 4)}***` : '(vacío)',
  });

  return successResponse({ actionUrl, fields });
});
