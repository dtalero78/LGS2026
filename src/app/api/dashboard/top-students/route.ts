import { NextResponse } from 'next/server';
import { handlerWithAuth } from '@/lib/api-helpers';
import { query } from '@/lib/postgres';

export const POST = handlerWithAuth(async () => {
  try {
    console.log('🏆 Top Students: Fetching from PostgreSQL');

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const result = await query(`
      SELECT
        a."primerNombre",
        a."primerApellido",
        a."nivel",
        a."plataforma",
        COUNT(b."_id") as asistencias
      FROM "ACADEMICA_BOOKINGS" b
      INNER JOIN "ACADEMICA" a ON b."visitorId" = a."_id"
      WHERE b."asistio" = true
        AND b."dia" >= $1
        AND b."dia" <= $2
      GROUP BY a."_id", a."primerNombre", a."primerApellido", a."nivel", a."plataforma"
      ORDER BY asistencias DESC
      LIMIT 5
    `, [firstDayOfMonth.toISOString(), lastDayOfMonth.toISOString()]);

    const topStudents = result.rows.map((row: any, index: number) => ({
      rank: index + 1,
      nombre: `${row.primerNombre || ''} ${row.primerApellido || ''}`.trim(),
      nivel: row.nivel || 'N/A',
      plataforma: row.plataforma || 'N/A',
      asistencias: parseInt(row.asistencias || '0')
    }));

    console.log('🏆 Top Students: PostgreSQL results:', topStudents);

    return NextResponse.json({ success: true, topStudents, source: 'postgres' });
  } catch (error: any) {
    console.error('🏆 Top Students Error:', error.message);
    return NextResponse.json({
      success: true,
      topStudents: [],
      source: 'fallback',
      error: error.message
    });
  }
});
