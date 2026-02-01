import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/advisors/[id]/stats
 *
 * Get statistics for a specific advisor
 *
 * Query params:
 * - startDate: ISO date string - Start date filter for stats calculation
 * - endDate: ISO date string - End date filter for stats calculation
 * - period: string - "week", "month", "year", "all" (default: "month")
 *
 * [id] can be the advisor's email
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

    const { searchParams } = new URL(request.url);
    const advisorId = decodeURIComponent(params.id);

    // Determine date range based on period
    const period = searchParams.get('period') || 'month';
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    if (!startDate && !endDate) {
      const now = new Date();
      endDate = now.toISOString();

      if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString();
      } else if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString();
      } else if (period === 'year') {
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startDate = yearAgo.toISOString();
      }
      // For 'all', don't set startDate
    }

    // Build WHERE clause for date filtering
    const conditions: string[] = [`c."advisor" = $1`];
    const values: any[] = [advisorId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`c."dia" >= $${paramIndex}::timestamp with time zone`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`c."dia" <= $${paramIndex}::timestamp with time zone`);
      values.push(endDate);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Execute multiple stats queries in parallel
    const [generalStatsResult, byTypeResult, byNivelResult, recentEventsResult] = await Promise.all([
      // General stats
      query(
        `SELECT
          COUNT(DISTINCT c."_id") as "totalEventos",
          COUNT(DISTINCT b."_id") as "totalInscripciones",
          COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "totalAsistencias",
          COUNT(DISTINCT CASE WHEN b."asistio" = false THEN b."_id" END) as "totalAusencias",
          COUNT(DISTINCT b."idEstudiante") as "estudiantesUnicos",
          ROUND(
            AVG(CASE WHEN b."asistio" = true THEN 1 ELSE 0 END)::numeric * 100,
            2
          ) as "promedioAsistencia"
        FROM "CALENDARIO" c
        LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
        ${whereClause}`,
        values
      ),

      // Stats by event type
      query(
        `SELECT
          c."tipo",
          COUNT(DISTINCT c."_id") as "totalEventos",
          COUNT(DISTINCT b."_id") as "totalInscripciones",
          COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "totalAsistencias"
        FROM "CALENDARIO" c
        LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
        ${whereClause}
        GROUP BY c."tipo"
        ORDER BY "totalEventos" DESC`,
        values
      ),

      // Stats by nivel
      query(
        `SELECT
          c."nivel",
          COUNT(DISTINCT c."_id") as "totalEventos",
          COUNT(DISTINCT b."_id") as "totalInscripciones",
          COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "totalAsistencias"
        FROM "CALENDARIO" c
        LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
        ${whereClause} AND c."nivel" IS NOT NULL
        GROUP BY c."nivel"
        ORDER BY "totalEventos" DESC`,
        values
      ),

      // Recent events (last 5)
      query(
        `SELECT
          c."_id",
          c."dia",
          c."hora",
          c."tipo",
          c."nivel",
          c."step",
          c."titulo",
          c."inscritos",
          COUNT(DISTINCT b."_id") as "bookingCount",
          COUNT(DISTINCT CASE WHEN b."asistio" = true THEN b."_id" END) as "asistenciasCount"
        FROM "CALENDARIO" c
        LEFT JOIN "ACADEMICA_BOOKINGS" b ON c."_id" = b."eventoId" OR c."_id" = b."idEvento"
        ${whereClause}
        GROUP BY c."_id"
        ORDER BY c."dia" DESC
        LIMIT 5`,
        values
      ),
    ]);

    const generalStats = generalStatsResult.rows[0] || {};
    const statsByType = byTypeResult.rows;
    const statsByNivel = byNivelResult.rows;
    const recentEvents = recentEventsResult.rows;

    return NextResponse.json({
      success: true,
      advisor: advisorId,
      period: {
        type: period,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      stats: {
        general: {
          totalEventos: parseInt(generalStats.totalEventos) || 0,
          totalInscripciones: parseInt(generalStats.totalInscripciones) || 0,
          totalAsistencias: parseInt(generalStats.totalAsistencias) || 0,
          totalAusencias: parseInt(generalStats.totalAusencias) || 0,
          estudiantesUnicos: parseInt(generalStats.estudiantesUnicos) || 0,
          promedioAsistencia: parseFloat(generalStats.promedioAsistencia) || 0,
        },
        byType: statsByType.map((row) => ({
          tipo: row.tipo,
          totalEventos: parseInt(row.totalEventos) || 0,
          totalInscripciones: parseInt(row.totalInscripciones) || 0,
          totalAsistencias: parseInt(row.totalAsistencias) || 0,
        })),
        byNivel: statsByNivel.map((row) => ({
          nivel: row.nivel,
          totalEventos: parseInt(row.totalEventos) || 0,
          totalInscripciones: parseInt(row.totalInscripciones) || 0,
          totalAsistencias: parseInt(row.totalAsistencias) || 0,
        })),
        recentEvents: recentEvents.map((row) => ({
          _id: row._id,
          dia: row.dia,
          hora: row.hora,
          tipo: row.tipo,
          nivel: row.nivel,
          step: row.step,
          titulo: row.titulo,
          inscritos: row.inscritos,
          bookingCount: parseInt(row.bookingCount) || 0,
          asistenciasCount: parseInt(row.asistenciasCount) || 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching advisor stats:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
