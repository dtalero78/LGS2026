import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * POST /api/postgres/academic/activity
 *
 * Generate student activity report
 *
 * Body:
 * - studentId: string - Student ID (_id or numeroId)
 * - startDate: ISO date string (optional) - Start date for activity range
 * - endDate: ISO date string (optional) - End date for activity range
 * - nivel: string (optional) - Filter by nivel
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
    const { studentId, startDate, endDate, nivel } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      );
    }

    // Get student details
    const studentResult = await query(
      `SELECT "_id", "numeroId", "primerNombre", "primerApellido",
              "nivel", "step", "email"
       FROM "PEOPLE"
       WHERE "_id" = $1 OR "numeroId" = $1`,
      [studentId]
    );

    if (studentResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentResult.rows[0];

    // Build WHERE clause for date/nivel filters
    const conditions: string[] = [
      `("idEstudiante" = $1 OR "studentId" = $1)`,
    ];
    const values: any[] = [student._id];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`"fechaEvento" >= $${paramIndex}::timestamp with time zone`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`"fechaEvento" <= $${paramIndex}::timestamp with time zone`);
      values.push(endDate);
      paramIndex++;
    }

    if (nivel) {
      conditions.push(`"nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get all bookings (classes) for the student
    const bookingsResult = await query(
      `SELECT
        "_id",
        "eventoId",
        "nivel",
        "step",
        "advisor",
        "fechaEvento",
        "hora",
        "tipo",
        "nombreEvento",
        "asistio",
        "asistencia",
        "participacion",
        "evaluacion",
        "comentarios",
        "noAprobo",
        "cancelo"
       FROM "ACADEMICA_BOOKINGS"
       ${whereClause}
       ORDER BY "fechaEvento" DESC`,
      values
    );

    const bookings = bookingsResult.rows;

    // Calculate statistics
    const totalClases = bookings.length;
    const asistencias = bookings.filter((b) => b.asistio === true).length;
    const ausencias = bookings.filter((b) => b.asistio === false).length;
    const pendientes = bookings.filter((b) => b.asistio === null).length;
    const porcentajeAsistencia =
      totalClases > 0 ? Math.round((asistencias / totalClases) * 100) : 0;

    // Group by nivel
    const byNivel: { [key: string]: any } = {};
    bookings.forEach((booking) => {
      if (!booking.nivel) return;

      if (!byNivel[booking.nivel]) {
        byNivel[booking.nivel] = {
          nivel: booking.nivel,
          totalClases: 0,
          asistencias: 0,
          ausencias: 0,
          pendientes: 0,
        };
      }

      byNivel[booking.nivel].totalClases++;
      if (booking.asistio === true) byNivel[booking.nivel].asistencias++;
      if (booking.asistio === false) byNivel[booking.nivel].ausencias++;
      if (booking.asistio === null) byNivel[booking.nivel].pendientes++;
    });

    // Group by tipo
    const byTipo: { [key: string]: any } = {};
    bookings.forEach((booking) => {
      if (!booking.tipo) return;

      if (!byTipo[booking.tipo]) {
        byTipo[booking.tipo] = {
          tipo: booking.tipo,
          totalClases: 0,
          asistencias: 0,
        };
      }

      byTipo[booking.tipo].totalClases++;
      if (booking.asistio === true) byTipo[booking.tipo].asistencias++;
    });

    // Recent classes (last 10)
    const recentClasses = bookings.slice(0, 10);

    return NextResponse.json({
      success: true,
      student: {
        _id: student._id,
        numeroId: student.numeroId,
        nombre: `${student.primerNombre} ${student.primerApellido}`,
        nivel: student.nivel,
        step: student.step,
      },
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        nivel: nivel || null,
      },
      stats: {
        totalClases,
        asistencias,
        ausencias,
        pendientes,
        porcentajeAsistencia,
      },
      byNivel: Object.values(byNivel),
      byTipo: Object.values(byTipo),
      recentClasses,
      allClasses: bookings,
    });
  } catch (error: any) {
    console.error('❌ Error generating student activity:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
