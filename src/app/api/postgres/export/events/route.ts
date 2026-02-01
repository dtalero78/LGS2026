import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/export/events
 *
 * Export events to CSV
 *
 * Query params:
 * - startDate: string (ISO date) - Filter events from this date
 * - endDate: string (ISO date) - Filter events until this date
 * - advisor: string - Filter by advisor ID
 * - nivel: string - Filter by level
 * - tipo: string - Filter by type
 */
export async function GET(request: Request) {
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const advisor = searchParams.get('advisor');
    const nivel = searchParams.get('nivel');
    const tipo = searchParams.get('tipo');

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`"dia" >= $${paramIndex}::timestamp`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`"dia" <= $${paramIndex}::timestamp`);
      values.push(endDate);
      paramIndex++;
    }

    if (advisor) {
      conditions.push(`"advisor" = $${paramIndex}`);
      values.push(advisor);
      paramIndex++;
    }

    if (nivel) {
      conditions.push(`"nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    if (tipo) {
      conditions.push(`"tipo" = $${paramIndex}`);
      values.push(tipo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get events with enrollment counts
    const result = await query(
      `SELECT
         c."_id",
         c."dia",
         c."hora",
         c."advisor",
         c."nivel",
         c."step",
         c."tipo",
         c."titulo",
         c."nombreEvento",
         c."tituloONivel",
         c."inscritos",
         c."limiteUsuarios",
         c."linkZoom",
         c."club",
         COUNT(DISTINCT b."_id") as bookings_count,
         COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as asistencias_count
       FROM "CALENDARIO" c
       LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
       ${whereClause}
       GROUP BY c."_id", c."dia", c."hora", c."advisor", c."nivel", c."step", c."tipo",
                c."titulo", c."nombreEvento", c."tituloONivel", c."inscritos", c."limiteUsuarios",
                c."linkZoom", c."club"
       ORDER BY c."dia" DESC`,
      values
    );

    // Convert to CSV
    const headers = [
      'ID',
      'Fecha',
      'Hora',
      'Advisor',
      'Nivel',
      'Step',
      'Tipo',
      'Titulo',
      'Nombre Evento',
      'Inscritos',
      'Limite',
      'Bookings',
      'Asistencias',
      'Link Zoom',
      'Club'
    ];

    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const csvRow = [
        row._id,
        row.dia ? new Date(row.dia).toISOString() : '',
        row.hora || '',
        row.advisor || '',
        row.nivel || '',
        row.step || '',
        row.tipo || '',
        `"${(row.titulo || '').replace(/"/g, '""')}"`,
        `"${(row.nombreEvento || '').replace(/"/g, '""')}"`,
        row.inscritos || 0,
        row.limiteUsuarios || 0,
        row.bookings_count || 0,
        row.asistencias_count || 0,
        row.linkZoom || '',
        row.club || ''
      ];
      csvRows.push(csvRow.join(','));
    }

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="events_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error exporting events:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
