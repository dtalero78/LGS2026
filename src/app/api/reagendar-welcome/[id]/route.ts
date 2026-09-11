import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

/**
 * POST /api/reagendar-welcome/[id]
 *
 * Endpoint público (link enviado por WhatsApp). [id] = ACADEMICA._id.
 * Reagenda la sesión Welcome del estudiante SIN tocar clave/login/detalles:
 *   - Si viene `foto`, la actualiza en ACADEMICA (opcional).
 *   - "Reemplazar": cancela los bookings WELCOME futuros activos (libera cupo)
 *     y crea el nuevo booking para `welcomeEventId` (suma cupo).
 */
export const POST = handler(async (
  request: Request,
  { params }: { params: Record<string, string> }
) => {
  const academicId = params.id;
  const body = await request.json();
  const { welcomeEventId, foto } = body;

  const student = await queryOne(
    `SELECT a."_id", a."numeroId", a."primerNombre", a."primerApellido", a."nivel", a."step"
     FROM "ACADEMICA" a WHERE a."_id" = $1`,
    [academicId]
  );
  if (!student) throw new NotFoundError('Registro académico', academicId);

  // Foto opcional (único dato de perfil editable en este flujo)
  if (foto) {
    await query(`UPDATE "ACADEMICA" SET "foto" = $1, "_updatedDate" = NOW() WHERE "_id" = $2`, [foto, academicId]);
  }

  if (!welcomeEventId) throw new ValidationError('Selecciona una fecha para tu sesión Welcome');

  // Evento nuevo
  const event = await queryOne(
    `SELECT "_id", "dia", "hora", "advisor", "linkZoom", "limiteUsuarios", "inscritos",
            "tipo", "evento", "nombreEvento", "tituloONivel", "titulo"
     FROM "CALENDARIO" WHERE "_id" = $1`,
    [welcomeEventId]
  );
  if (!event) throw new ValidationError('La sesión Welcome seleccionada no existe');
  if (event.limiteUsuarios > 0 && event.inscritos >= event.limiteUsuarios) {
    throw new ValidationError('Esa sesión Welcome está llena, elige otra fecha');
  }

  // ¿Ya está agendado exactamente en ESE evento? → no duplicar
  const already = await queryOne(
    `SELECT "_id" FROM "ACADEMICA_BOOKINGS"
     WHERE ("studentId" = $1 OR "idEstudiante" = $1)
       AND ("eventoId" = $2 OR "idEvento" = $2)
       AND "cancelo" IS NOT TRUE
     LIMIT 1`,
    [academicId, welcomeEventId]
  );

  // Reemplazar: cancelar bookings WELCOME futuros activos (distintos del nuevo) + liberar su cupo
  const futuros = await queryMany<{ _id: string; evId: string | null }>(
    `SELECT "_id", COALESCE("eventoId", "idEvento") AS "evId"
     FROM "ACADEMICA_BOOKINGS"
     WHERE ("studentId" = $1 OR "idEstudiante" = $1)
       AND ("tipoEvento" = 'WELCOME' OR "tipo" = 'WELCOME')
       AND "fechaEvento" > NOW()
       AND "cancelo" IS NOT TRUE
       AND COALESCE("eventoId", "idEvento") <> $2`,
    [academicId, welcomeEventId]
  );
  for (const b of futuros) {
    await query(`UPDATE "ACADEMICA_BOOKINGS" SET "cancelo" = true, "_updatedDate" = NOW() WHERE "_id" = $1`, [b._id]);
    if (b.evId) {
      await query(
        `UPDATE "CALENDARIO" SET "inscritos" = GREATEST(COALESCE("inscritos", 0) - 1, 0), "_updatedDate" = NOW() WHERE "_id" = $1`,
        [b.evId]
      );
    }
  }

  let bookingId: string;
  let bookingCreated = false;

  if (already) {
    bookingId = already._id; // ya estaba agendado en ese evento; no se duplica
  } else {
    bookingId = ids.booking();
    const eventType = event.tipo || event.evento || 'WELCOME';
    await query(
      `INSERT INTO "ACADEMICA_BOOKINGS" (
        "_id", "eventoId", "idEvento", "studentId", "idEstudiante",
        "primerNombre", "primerApellido",
        "nivel", "step", "advisor", "fecha", "fechaEvento", "hora",
        "tipo", "tipoEvento", "linkZoom", "nombreEvento", "tituloONivel",
        "asistio", "asistencia", "participacion", "noAprobo", "cancelo",
        "agendadoPor", "origen",
        "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        false, false, false, false, false,
        'ESTUDIANTE', 'POSTGRES',
        NOW(), NOW()
      )`,
      [
        bookingId,
        welcomeEventId,
        welcomeEventId,
        academicId,
        academicId,
        student.primerNombre,
        student.primerApellido,
        student.nivel || 'WELCOME',
        student.step || 'WELCOME',
        event.advisor || null,
        event.dia,
        event.dia,
        event.hora || null,
        eventType,
        eventType,
        event.linkZoom || null,
        event.nombreEvento || event.titulo || 'WELCOME',
        event.tituloONivel || null,
      ]
    );
    await query(
      `UPDATE "CALENDARIO" SET "inscritos" = COALESCE("inscritos", 0) + 1, "_updatedDate" = NOW() WHERE "_id" = $1`,
      [welcomeEventId]
    );
    bookingCreated = true;
  }

  return successResponse({
    message: 'Sesión Welcome reagendada',
    bookingId,
    bookingCreated,
    canceladas: futuros.length,
  });
});
