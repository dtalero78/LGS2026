import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-postgres';

/**
 * GET /api/postgres/reports/attendance
 *
 * Generate attendance report
 *
 * Query params:
 * - startDate: string (ISO date) - Start date for report
 * - endDate: string (ISO date) - End date for report
 * - advisor: string - Filter by advisor ID
 * - nivel: string - Filter by level
 * - studentId: string - Filter by specific student
 * - format: 'json' | 'csv' - Response format (default: json)
 *
 * Returns summary of attendance by student with percentage
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
    const studentId = searchParams.get('studentId');
    const format = searchParams.get('format') || 'json';

    // Build WHERE clause
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`b."fechaEvento" >= $${paramIndex}::timestamp`);
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`b."fechaEvento" <= $${paramIndex}::timestamp`);
      values.push(endDate);
      paramIndex++;
    }

    if (advisor) {
      conditions.push(`b."advisor" = $${paramIndex}`);
      values.push(advisor);
      paramIndex++;
    }

    if (nivel) {
      conditions.push(`b."nivel" = $${paramIndex}`);
      values.push(nivel);
      paramIndex++;
    }

    if (studentId) {
      conditions.push(`b."idEstudiante" = $${paramIndex}`);
      values.push(studentId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get attendance statistics
    const result = await query(
      `SELECT
         b."idEstudiante",
         b."primerNombre",
         b."primerApellido",
         b."nivel",
         p."plataforma",
         COUNT(*) as total_clases,
         COUNT(CASE WHEN b."asistio" = true THEN 1 END) as asistencias,
         COUNT(CASE WHEN b."asistio" = false THEN 1 END) as ausencias,
         ROUND(
           (COUNT(CASE WHEN b."asistio" = true THEN 1 END)::numeric / COUNT(*)::numeric * 100),
           2
         ) as porcentaje_asistencia
       FROM "ACADEMICA_BOOKINGS" b
       LEFT JOIN "PEOPLE" p ON b."idEstudiante" = p."_id"
       ${whereClause}
       GROUP BY b."idEstudiante", b."primerNombre", b."primerApellido", b."nivel", p."plataforma"
       ORDER BY porcentaje_asistencia DESC, asistencias DESC`,
      values
    );

    const students = result.rows.map((row: any) => ({
      studentId: row.idEstudiante,
      primerNombre: row.primerNombre,
      primerApellido: row.primerApellido,
      nivel: row.nivel,
      plataforma: row.plataforma,
      totalClases: parseInt(row.total_clases),
      asistencias: parseInt(row.asistencias),
      ausencias: parseInt(row.ausencias),
      porcentajeAsistencia: parseFloat(row.porcentaje_asistencia)
    }));

    // Calculate totals
    const totals = {
      totalStudents: students.length,
      totalClases: students.reduce((sum, s) => sum + s.totalClases, 0),
      totalAsistencias: students.reduce((sum, s) => sum + s.asistencias, 0),
      totalAusencias: students.reduce((sum, s) => sum + s.ausencias, 0),
      promedioAsistencia: students.length > 0
        ? students.reduce((sum, s) => sum + s.porcentajeAsistencia, 0) / students.length
        : 0
    };

    // Return CSV format if requested
    if (format === 'csv') {
      const headers = [
        'Student ID',
        'Primer Nombre',
        'Primer Apellido',
        'Nivel',
        'Plataforma',
        'Total Clases',
        'Asistencias',
        'Ausencias',
        'Porcentaje Asistencia'
      ];

      const csvRows = [headers.join(',')];

      for (const student of students) {
        const csvRow = [
          student.studentId,
          `"${student.primerNombre.replace(/"/g, '""')}"`,
          `"${student.primerApellido.replace(/"/g, '""')}"`,
          student.nivel || '',
          student.plataforma || '',
          student.totalClases,
          student.asistencias,
          student.ausencias,
          student.porcentajeAsistencia
        ];
        csvRows.push(csvRow.join(','));
      }

      // Add totals row
      csvRows.push('');
      csvRows.push(`TOTALES,,,,,${totals.totalClases},${totals.totalAsistencias},${totals.totalAusencias},${totals.promedioAsistencia.toFixed(2)}`);

      const csv = csvRows.join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="attendance_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json({
      success: true,
      report: {
        students,
        totals,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          advisor: advisor || null,
          nivel: nivel || null,
          studentId: studentId || null
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Error generating attendance report:', error);
    return NextResponse.json(
      {
        error: 'Database error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
