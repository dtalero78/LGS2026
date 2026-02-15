import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { PeopleRepository } from '@/repositories/people.repository';
import { ValidationError } from '@/lib/errors';
import { queryMany } from '@/lib/postgres';

/**
 * POST /api/postgres/academic/activity
 *
 * Generate student activity report with attendance stats.
 */
export const POST = handlerWithAuth(async (request) => {
  const body = await request.json();
  const { studentId, startDate, endDate, nivel } = body;

  if (!studentId) throw new ValidationError('studentId is required');

  const student = await PeopleRepository.findByIdOrNumeroIdOrThrow(studentId);

  // Build dynamic WHERE for bookings
  const conditions: string[] = [`("idEstudiante" = $1 OR "studentId" = $1)`];
  const values: any[] = [student._id];
  let idx = 2;

  if (startDate) { conditions.push(`"fechaEvento" >= $${idx}::timestamp with time zone`); values.push(startDate); idx++; }
  if (endDate) { conditions.push(`"fechaEvento" <= $${idx}::timestamp with time zone`); values.push(endDate); idx++; }
  if (nivel) { conditions.push(`"nivel" = $${idx}`); values.push(nivel); idx++; }

  const bookings = await queryMany(
    `SELECT "_id", "eventoId", "nivel", "step", "advisor", "fechaEvento", "hora",
            "tipo", "nombreEvento", "asistio", "asistencia", "participacion",
            "evaluacion", "comentarios", "noAprobo", "cancelo"
     FROM "ACADEMICA_BOOKINGS"
     WHERE ${conditions.join(' AND ')}
     ORDER BY "fechaEvento" DESC`,
    values
  );

  const totalClases = bookings.length;
  const asistencias = bookings.filter((b) => b.asistio === true).length;
  const ausencias = bookings.filter((b) => b.asistio === false).length;
  const pendientes = bookings.filter((b) => b.asistio === null).length;

  // Group by nivel
  const byNivelMap: Record<string, any> = {};
  const byTipoMap: Record<string, any> = {};
  for (const b of bookings) {
    if (b.nivel) {
      if (!byNivelMap[b.nivel]) byNivelMap[b.nivel] = { nivel: b.nivel, totalClases: 0, asistencias: 0, ausencias: 0, pendientes: 0 };
      byNivelMap[b.nivel].totalClases++;
      if (b.asistio === true) byNivelMap[b.nivel].asistencias++;
      if (b.asistio === false) byNivelMap[b.nivel].ausencias++;
      if (b.asistio === null) byNivelMap[b.nivel].pendientes++;
    }
    if (b.tipo) {
      if (!byTipoMap[b.tipo]) byTipoMap[b.tipo] = { tipo: b.tipo, totalClases: 0, asistencias: 0 };
      byTipoMap[b.tipo].totalClases++;
      if (b.asistio === true) byTipoMap[b.tipo].asistencias++;
    }
  }

  return successResponse({
    student: {
      _id: student._id,
      numeroId: student.numeroId,
      nombre: `${student.primerNombre} ${student.primerApellido}`,
      nivel: student.nivel,
      step: student.step,
    },
    filters: { startDate: startDate || null, endDate: endDate || null, nivel: nivel || null },
    stats: {
      totalClases,
      asistencias,
      ausencias,
      pendientes,
      porcentajeAsistencia: totalClases > 0 ? Math.round((asistencias / totalClases) * 100) : 0,
    },
    byNivel: Object.values(byNivelMap),
    byTipo: Object.values(byTipoMap),
    recentClasses: bookings.slice(0, 10),
    allClasses: bookings,
  });
});
