/**
 * GET /api/postgres/reports/attendance
 * Attendance report with optional filters, supports JSON and CSV output
 */

import { NextResponse } from 'next/server';
import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';

export const GET = handlerWithAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const advisor = searchParams.get('advisor');
  const nivel = searchParams.get('nivel');
  const studentId = searchParams.get('studentId');
  const format = searchParams.get('format') || 'json';

  const conditions: string[] = [];
  const values: any[] = [];
  let pi = 1;

  if (startDate) { conditions.push(`b."fechaEvento" >= $${pi}::timestamp`); values.push(startDate); pi++; }
  if (endDate) { conditions.push(`b."fechaEvento" <= $${pi}::timestamp`); values.push(endDate); pi++; }
  if (advisor) { conditions.push(`b."advisor" = $${pi}`); values.push(advisor); pi++; }
  if (nivel) { conditions.push(`b."nivel" = $${pi}`); values.push(nivel); pi++; }
  if (studentId) { conditions.push(`b."idEstudiante" = $${pi}`); values.push(studentId); pi++; }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT b."idEstudiante", b."primerNombre", b."primerApellido", b."nivel", p."plataforma",
            COUNT(*) as total_clases,
            COUNT(CASE WHEN b."asistio" = true THEN 1 END) as asistencias,
            COUNT(CASE WHEN b."asistio" = false THEN 1 END) as ausencias,
            ROUND((COUNT(CASE WHEN b."asistio" = true THEN 1 END)::numeric / COUNT(*)::numeric * 100), 2) as porcentaje_asistencia
     FROM "ACADEMICA_BOOKINGS" b
     LEFT JOIN "PEOPLE" p ON b."idEstudiante" = p."_id"
     ${whereClause}
     GROUP BY b."idEstudiante", b."primerNombre", b."primerApellido", b."nivel", p."plataforma"
     ORDER BY porcentaje_asistencia DESC, asistencias DESC`,
    values
  );

  const students = result.rows.map((r: any) => ({
    studentId: r.idEstudiante, primerNombre: r.primerNombre, primerApellido: r.primerApellido,
    nivel: r.nivel, plataforma: r.plataforma, totalClases: parseInt(r.total_clases),
    asistencias: parseInt(r.asistencias), ausencias: parseInt(r.ausencias),
    porcentajeAsistencia: parseFloat(r.porcentaje_asistencia),
  }));

  const totals = {
    totalStudents: students.length,
    totalClases: students.reduce((s: number, x: any) => s + x.totalClases, 0),
    totalAsistencias: students.reduce((s: number, x: any) => s + x.asistencias, 0),
    totalAusencias: students.reduce((s: number, x: any) => s + x.ausencias, 0),
    promedioAsistencia: students.length > 0
      ? students.reduce((s: number, x: any) => s + x.porcentajeAsistencia, 0) / students.length : 0,
  };

  if (format === 'csv') {
    const headers = ['Student ID','Primer Nombre','Primer Apellido','Nivel','Plataforma','Total Clases','Asistencias','Ausencias','Porcentaje Asistencia'];
    const csvRows = [headers.join(',')];
    for (const s of students) {
      csvRows.push([s.studentId, `"${s.primerNombre.replace(/"/g,'""')}"`, `"${s.primerApellido.replace(/"/g,'""')}"`,
        s.nivel || '', s.plataforma || '', s.totalClases, s.asistencias, s.ausencias, s.porcentajeAsistencia].join(','));
    }
    csvRows.push('');
    csvRows.push(`TOTALES,,,,,${totals.totalClases},${totals.totalAsistencias},${totals.totalAusencias},${totals.promedioAsistencia.toFixed(2)}`);

    return new NextResponse(csvRows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance_report_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return successResponse({
    report: {
      students,
      totals,
      filters: { startDate: startDate || null, endDate: endDate || null, advisor: advisor || null, nivel: nivel || null, studentId: studentId || null }
    },
  });
});
