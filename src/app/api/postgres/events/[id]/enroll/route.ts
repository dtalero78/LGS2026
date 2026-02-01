import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/events/[id]/enroll
 *
 * Enroll student(s) in an event
 *
 * Body:
 * {
 *   studentIds: string[],        // Array of student IDs to enroll
 *   agendadoPor?: string,         // Who scheduled it (optional)
 *   agendadoPorEmail?: string,    // Email of scheduler (optional)
 *   agendadoPorRol?: string       // Role of scheduler (optional)
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.studentIds || !Array.isArray(body.studentIds)) {
      return NextResponse.json(
        { error: 'studentIds array is required' },
        { status: 400 }
      );
    }

    if (body.studentIds.length === 0) {
      return NextResponse.json(
        { error: 'studentIds array cannot be empty' },
        { status: 400 }
      );
    }

    // Get event details
    const eventResult = await query(
      `SELECT "_id", "dia", "hora", "advisor", "nivel", "step", "tipo", "linkZoom",
              "inscritos", "limiteUsuarios", "nombreEvento", "tituloONivel"
       FROM "CALENDARIO"
       WHERE "_id" = $1`,
      [params.id]
    );

    if (eventResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventResult.rows[0];

    // Check if event is full
    if (event.limiteUsuarios && event.inscritos >= event.limiteUsuarios) {
      return NextResponse.json(
        { error: 'Event is full' },
        { status: 400 }
      );
    }

    // Get student details for all students
    const studentsResult = await query(
      `SELECT "_id", "primerNombre", "primerApellido", "numeroId", "celular",
              "nivel", "step", "plataforma"
       FROM "PEOPLE"
       WHERE "_id" = ANY($1::text[])`,
      [body.studentIds]
    );

    if (studentsResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'No valid students found' },
        { status: 404 }
      );
    }

    const students = studentsResult.rows;
    const bookings = [];

    // Create booking for each student
    for (const student of students) {
      const bookingId = `bkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const bookingResult = await query(
        `INSERT INTO "ACADEMICA_BOOKINGS" (
          "_id", "eventoId", "idEvento", "studentId", "idEstudiante",
          "primerNombre", "primerApellido", "numeroId", "celular",
          "nivel", "step", "advisor", "fecha", "fechaEvento", "hora",
          "tipo", "tipoEvento", "linkZoom", "nombreEvento", "tituloONivel",
          "asistio", "asistencia", "participacion", "noAprobo", "cancelo",
          "agendadoPor", "agendadoPorEmail", "agendadoPorRol",
          "fechaAgendamiento", "origen", "_createdDate", "_updatedDate"
        ) VALUES (
          $1, $2, $2, $3, $3,
          $4, $5, $6, $7,
          $8, $9, $10, $11, $11, $12,
          $13, $13, $14, $15, $16,
          false, false, false, false, false,
          $17, $18, $19,
          NOW(), 'POSTGRES', NOW(), NOW()
        )
        RETURNING *`,
        [
          bookingId,
          event._id,
          student._id,
          student.primerNombre,
          student.primerApellido,
          student.numeroId,
          student.celular,
          student.nivel || event.nivel,
          student.step || event.step,
          event.advisor,
          event.dia,
          event.hora,
          event.tipo,
          event.linkZoom,
          event.nombreEvento,
          event.tituloONivel,
          body.agendadoPor || session.user?.name || null,
          body.agendadoPorEmail || session.user?.email || null,
          body.agendadoPorRol || (session.user as any)?.role || null
        ]
      );

      bookings.push(bookingResult.rows[0]);
    }

    // Update inscritos count
    await query(
      `UPDATE "CALENDARIO"
       SET "inscritos" = "inscritos" + $1,
           "_updatedDate" = NOW()
       WHERE "_id" = $2`,
      [bookings.length, params.id]
    );

    return NextResponse.json({
      success: true,
      bookings,
      enrolled: bookings.length,
      message: `${bookings.length} estudiante(s) inscrito(s) exitosamente`,
    });
  } catch (error: any) {
    console.error('❌ Error enrolling students:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
