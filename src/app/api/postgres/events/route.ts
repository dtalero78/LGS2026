import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/events
 *
 * Create a new event in the calendar
 *
 * Body:
 * {
 *   dia: string,                  // Event date/time (ISO timestamp)
 *   hora: string,                 // Hour (e.g., "11:00", "17:00")
 *   advisor: string,              // Advisor ID
 *   nivel?: string,               // Level (BN1, BN2, etc.)
 *   step?: string,                // Step
 *   tipo?: string,                // Type (SESSION, CLUB, WELCOME, etc.)
 *   titulo?: string,              // Event title
 *   nombreEvento?: string,        // Event name
 *   linkZoom?: string,            // Zoom link
 *   limiteUsuarios?: number,      // Max participants
 *   club?: string,                // Club name (if tipo = CLUB)
 *   observaciones?: string        // Notes
 * }
 */
export async function POST(request: Request) {
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
    if (!body.dia) {
      return NextResponse.json(
        { error: 'dia is required' },
        { status: 400 }
      );
    }

    if (!body.advisor) {
      return NextResponse.json(
        { error: 'advisor is required' },
        { status: 400 }
      );
    }

    // Generate new ID
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract date and hora from dia timestamp
    const diaDate = new Date(body.dia);
    const fecha = diaDate.toISOString().split('T')[0]; // YYYY-MM-DD
    // If hora not provided separately, extract from dia timestamp
    const hora = body.hora || `${diaDate.getHours().toString().padStart(2, '0')}:${diaDate.getMinutes().toString().padStart(2, '0')}`;

    // Build tituloONivel
    let tituloONivel = body.titulo || body.nombreEvento || '';
    if (body.nivel) {
      tituloONivel = body.nivel + (body.step ? ` - ${body.step}` : '');
    }

    // Insert event
    const result = await query(
      `INSERT INTO "CALENDARIO" (
        "_id", "dia", "fecha", "hora", "advisor", "nivel", "step", "tipo",
        "titulo", "nombreEvento", "tituloONivel", "linkZoom", "limiteUsuarios",
        "club", "observaciones", "inscritos", "origen", "_createdDate", "_updatedDate"
      ) VALUES (
        $1, $2::timestamp with time zone, $3::date, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, 0, 'POSTGRES', NOW(), NOW()
      )
      RETURNING *`,
      [
        eventId,
        body.dia,
        fecha,
        hora,
        body.advisor,
        body.nivel || null,
        body.step || null,
        body.tipo || body.evento || 'SESSION',
        body.titulo || body.tituloONivel || null,
        body.nombreEvento || null,
        tituloONivel || body.tituloONivel || '',
        body.linkZoom || null,
        body.limiteUsuarios || 30,
        body.club || null,
        body.observaciones || null
      ]
    );

    return NextResponse.json({
      success: true,
      event: result.rows[0],
      message: 'Evento creado exitosamente',
    });
  } catch (error: any) {
    console.error('❌ Error creating event:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
