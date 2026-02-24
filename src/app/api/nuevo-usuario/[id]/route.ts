import 'server-only';
import { handler, successResponse } from '@/lib/api-helpers';
import { query, queryOne, queryMany } from '@/lib/postgres';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { ids } from '@/lib/id-generator';

// One-time migration: ensure columns exist (idempotent, runs once per server start)
let migrationDone = false;
async function ensureColumns() {
  if (migrationDone) return;
  try {
    await query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "detallesPersonales" TEXT`, []);
    await query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "hobbies" TEXT`, []);
    await query(`ALTER TABLE "ACADEMICA" ADD COLUMN IF NOT EXISTS "foto" TEXT`, []);
    migrationDone = true;
    console.log('✅ [NuevoUsuario] Columnas verificadas en ACADEMICA');
  } catch (err: any) {
    console.error('⚠️ [NuevoUsuario] Error verificando columnas:', err.message);
  }
}

/**
 * GET /api/nuevo-usuario/[id]
 *
 * Public endpoint. Loads student data for registration form.
 * [id] = ACADEMICA._id (sent via WhatsApp link)
 */
export const GET = handler(async (
  _request: Request,
  { params }: { params: Record<string, string> }
) => {
  const academicId = params.id;

  await ensureColumns();

  // Get ACADEMICA record
  const student = await queryOne(
    `SELECT a."_id", a."numeroId", a."primerNombre", a."segundoNombre",
            a."primerApellido", a."segundoApellido", a."email", a."celular",
            a."nivel", a."step", a."plataforma", a."usuarioId",
            a."detallesPersonales", a."hobbies", a."foto", a."clave"
     FROM "ACADEMICA" a
     WHERE a."_id" = $1`,
    [academicId]
  );
  if (!student) throw new NotFoundError('Registro académico', academicId);

  // Check if already registered (has detallesPersonales or clave)
  const alreadyRegistered = !!(student.clave && student.detallesPersonales);

  // Get available WELCOME events (future dates only)
  let welcomeEvents: any[] = [];
  if (student.nivel === 'WELCOME') {
    welcomeEvents = await queryMany(
      `SELECT "_id", "dia", "hora", "advisor", "linkZoom", "limiteUsuarios", "inscritos",
              "titulo", "nombreEvento"
       FROM "CALENDARIO"
       WHERE ("tipo" = 'WELCOME' OR "evento" = 'WELCOME' OR "nombreEvento" = 'WELCOME')
         AND "dia" > NOW()
       ORDER BY "dia" ASC
       LIMIT 30`,
      []
    );
  }

  // Check if student already has a future WELCOME booking
  let hasWelcomeBooking = false;
  if (student.nivel === 'WELCOME') {
    const existingBooking = await queryOne(
      `SELECT "_id" FROM "ACADEMICA_BOOKINGS"
       WHERE ("studentId" = $1 OR "idEstudiante" = $1)
         AND ("tipoEvento" = 'WELCOME' OR "tipo" = 'WELCOME')
         AND "fechaEvento" > NOW()
       LIMIT 1`,
      [academicId]
    );
    hasWelcomeBooking = !!existingBooking;
  }

  return successResponse({
    student: {
      _id: student._id,
      primerNombre: student.primerNombre,
      segundoNombre: student.segundoNombre,
      primerApellido: student.primerApellido,
      segundoApellido: student.segundoApellido,
      email: student.email,
      celular: student.celular,
      nivel: student.nivel,
      plataforma: student.plataforma,
      foto: student.foto,
    },
    welcomeEvents: welcomeEvents.map(e => ({
      _id: e._id,
      dia: e.dia,
      hora: e.hora,
      advisor: e.advisor,
      linkZoom: e.linkZoom,
      limiteUsuarios: e.limiteUsuarios,
      inscritos: e.inscritos,
      lleno: e.limiteUsuarios > 0 && e.inscritos >= e.limiteUsuarios,
    })),
    hasWelcomeBooking,
    alreadyRegistered,
  });
});

/**
 * POST /api/nuevo-usuario/[id]
 *
 * Public endpoint. Complete student registration:
 * 1. Update ACADEMICA with personal details (detallesPersonales, hobbies, email, clave, foto)
 * 2. Optionally create a WELCOME booking
 */
export const POST = handler(async (
  request: Request,
  { params }: { params: Record<string, string> }
) => {
  const academicId = params.id;
  const body = await request.json();

  const { detallesPersonales, hobbies, email, clave, foto, welcomeEventId } = body;

  // Validate required fields
  if (!detallesPersonales?.trim()) throw new ValidationError('Detalles personales es requerido');
  if (!hobbies?.trim()) throw new ValidationError('Hobbies es requerido');
  if (!email?.trim()) throw new ValidationError('Email/usuario es requerido');
  if (!clave?.trim()) throw new ValidationError('Clave es requerida');

  // Get ACADEMICA record
  const student = await queryOne(
    `SELECT "_id", "numeroId", "primerNombre", "primerApellido", "celular",
            "nivel", "step", "plataforma", "usuarioId"
     FROM "ACADEMICA" WHERE "_id" = $1`,
    [academicId]
  );
  if (!student) throw new NotFoundError('Registro académico', academicId);

  // Update ACADEMICA with registration data
  await query(
    `UPDATE "ACADEMICA"
     SET "detallesPersonales" = $1,
         "hobbies" = $2,
         "email" = $3,
         "clave" = $4,
         "foto" = COALESCE($5, "foto"),
         "_updatedDate" = NOW()
     WHERE "_id" = $6`,
    [detallesPersonales.trim(), hobbies.trim(), email.trim(), clave.trim(), foto || null, academicId]
  );
  console.log(`✅ [NuevoUsuario] ACADEMICA actualizado para ${student.primerNombre} ${student.primerApellido}`);

  // Create WELCOME booking if event selected
  let bookingCreated = false;
  let bookingId: string | null = null;

  if (welcomeEventId) {
    // Get the event data
    const event = await queryOne(
      `SELECT "_id", "dia", "hora", "advisor", "linkZoom", "limiteUsuarios", "inscritos",
              "tipo", "evento", "nombreEvento", "tituloONivel", "titulo"
       FROM "CALENDARIO" WHERE "_id" = $1`,
      [welcomeEventId]
    );

    if (!event) {
      console.error(`⚠️ [NuevoUsuario] Evento WELCOME no encontrado: ${welcomeEventId}`);
    } else if (event.limiteUsuarios > 0 && event.inscritos >= event.limiteUsuarios) {
      console.error(`⚠️ [NuevoUsuario] Evento WELCOME lleno: ${welcomeEventId}`);
    } else {
      // Check for existing booking
      const existingBooking = await queryOne(
        `SELECT "_id" FROM "ACADEMICA_BOOKINGS"
         WHERE ("studentId" = $1 OR "idEstudiante" = $1)
           AND ("eventoId" = $2 OR "idEvento" = $2)
         LIMIT 1`,
        [academicId, welcomeEventId]
      );

      if (existingBooking) {
        console.log(`ℹ️ [NuevoUsuario] Booking ya existe para evento ${welcomeEventId}`);
        bookingId = existingBooking._id;
        bookingCreated = false;
      } else {
        bookingId = ids.booking();
        await query(
          `INSERT INTO "ACADEMICA_BOOKINGS" (
            "_id", "eventoId", "idEvento", "studentId", "idEstudiante",
            "primerNombre", "primerApellido", "numeroId", "celular",
            "nivel", "step", "advisor", "fecha", "fechaEvento", "hora",
            "tipo", "tipoEvento", "linkZoom", "nombreEvento", "tituloONivel",
            "asistio", "asistencia", "participacion", "noAprobo", "cancelo",
            "agendadoPor", "origen", "plataforma",
            "_createdDate", "_updatedDate"
          ) VALUES (
            $1, $2, $2, $3, $3,
            $4, $5, $6, $7,
            $8, $9, $10, $11, $11, $12,
            $13, $13, $14, $15, $16,
            false, false, false, false, false,
            'ESTUDIANTE', 'POSTGRES', $17,
            NOW(), NOW()
          )`,
          [
            bookingId,
            welcomeEventId,
            academicId,
            student.primerNombre,
            student.primerApellido,
            student.numeroId,
            student.celular || null,
            student.nivel || 'WELCOME',
            student.step || 'WELCOME',
            event.advisor || null,
            event.dia,
            event.hora || null,
            event.tipo || event.evento || 'WELCOME',
            event.linkZoom || null,
            event.nombreEvento || event.titulo || 'WELCOME',
            event.tituloONivel || null,
            student.plataforma || null,
          ]
        );

        // Increment inscritos on the event
        await query(
          `UPDATE "CALENDARIO" SET "inscritos" = COALESCE("inscritos", 0) + 1, "_updatedDate" = NOW() WHERE "_id" = $1`,
          [welcomeEventId]
        );

        bookingCreated = true;
        console.log(`✅ [NuevoUsuario] Booking WELCOME creado: ${bookingId}`);
      }
    }
  }

  return successResponse({
    message: 'Registro completado exitosamente',
    bookingCreated,
    bookingId,
  });
});
