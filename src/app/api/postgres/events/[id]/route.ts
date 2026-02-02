import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/events/[id]
 *
 * Get a single event by ID
 */
export async function GET(
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

    const result = await query(
      `SELECT
        c.*,
        a."primerNombre" as "advisorPrimerNombre",
        a."primerApellido" as "advisorPrimerApellido",
        a."nombreCompleto" as "advisorNombreCompleto",
        a."email" as "advisorEmail"
      FROM "CALENDARIO" c
      LEFT JOIN "ADVISORS" a ON c."advisor" = a."_id"
      WHERE c."_id" = $1`,
      [params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event: result.rows[0],
    });
  } catch (error: any) {
    console.error('❌ Error fetching event:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/postgres/events/[id]
 *
 * Update an existing event
 *
 * Body: Same as POST, all fields optional
 */
export async function PUT(
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

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Allowed fields to update
    const allowedFields = [
      'dia',
      'hora',
      'advisor',
      'nivel',
      'step',
      'tipo',
      'titulo',
      'nombreEvento',
      'linkZoom',
      'limiteUsuarios',
      'club',
      'observaciones'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'dia') {
          // Update both dia and fecha when dia changes
          updates.push(`"dia" = $${paramIndex}::timestamp with time zone`);
          values.push(body[field]);
          paramIndex++;

          const diaDate = new Date(body[field]);
          const fecha = diaDate.toISOString().split('T')[0];
          updates.push(`"fecha" = $${paramIndex}::date`);
          values.push(fecha);
          paramIndex++;
        } else {
          updates.push(`"${field}" = $${paramIndex}`);
          values.push(body[field]);
          paramIndex++;
        }
      }
    }

    // Update tituloONivel if nivel or step changed
    if (body.nivel || body.step) {
      // Get current event to merge with new values
      const currentEvent = await query(
        `SELECT "nivel", "step", "titulo", "nombreEvento" FROM "CALENDARIO" WHERE "_id" = $1`,
        [params.id]
      );

      if (currentEvent.rowCount > 0) {
        const event = currentEvent.rows[0];
        const nivel = body.nivel !== undefined ? body.nivel : event.nivel;
        const step = body.step !== undefined ? body.step : event.step;

        let tituloONivel = body.titulo || body.nombreEvento || event.titulo || event.nombreEvento || '';
        if (nivel) {
          tituloONivel = nivel + (step ? ` - ${step}` : '');
        }

        updates.push(`"tituloONivel" = $${paramIndex}`);
        values.push(tituloONivel);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add _updatedDate
    updates.push(`"_updatedDate" = NOW()`);

    // Add event ID as last parameter
    values.push(params.id);

    const result = await query(
      `UPDATE "CALENDARIO"
       SET ${updates.join(', ')}
       WHERE "_id" = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event: result.rows[0],
      updated: updates.length - 1, // Exclude _updatedDate from count
    });
  } catch (error: any) {
    console.error('❌ Error updating event:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/postgres/events/[id]
 *
 * Delete an event from the calendar
 *
 * Query params:
 * - deleteBookings: boolean (default: false) - Also delete associated bookings
 */
export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const deleteBookings = searchParams.get('deleteBookings') === 'true';

    // Check if event exists
    const eventCheck = await query(
      `SELECT "_id", "inscritos" FROM "CALENDARIO" WHERE "_id" = $1`,
      [params.id]
    );

    if (eventCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventCheck.rows[0];

    // Delete associated bookings if requested
    let bookingsDeleted = 0;
    if (deleteBookings) {
      const bookingsResult = await query(
        `DELETE FROM "ACADEMICA_BOOKINGS"
         WHERE "eventoId" = $1 OR "idEvento" = $1
         RETURNING "_id"`,
        [params.id]
      );
      bookingsDeleted = bookingsResult.rowCount || 0;
    }

    // Delete event
    await query(
      `DELETE FROM "CALENDARIO" WHERE "_id" = $1`,
      [params.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Evento eliminado exitosamente',
      eventId: params.id,
      bookingsDeleted,
    });
  } catch (error: any) {
    console.error('❌ Error deleting event:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
