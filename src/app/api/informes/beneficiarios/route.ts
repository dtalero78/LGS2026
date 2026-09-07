/**
 * POST /api/informes/beneficiarios
 * Obtiene todos los beneficiarios en un rango de fechas con su total de sesiones
 */

import { handlerWithAuth, successResponse } from '@/lib/api-helpers';
import { ValidationError } from '@/lib/errors';
import { query } from '@/lib/postgres';

export const POST = handlerWithAuth(async (req) => {
  const body = await req.json();
  const { fechaInicio, fechaFin } = body;

  if (!fechaInicio || !fechaFin) {
    throw new ValidationError('fechaInicio y fechaFin son requeridos');
  }

  console.log('📊 [PostgreSQL] Generando informe de beneficiarios:', { fechaInicio, fechaFin });

  const result = await query(
    `SELECT
      p."_id",
      p."primerNombre",
      p."segundoNombre",
      p."primerApellido",
      p."segundoApellido",
      p."numeroId",
      p."email",
      p."celular",
      p."nivel",
      p."step",
      p."contrato",
      p."plataforma",
      p."tipoUsuario",
      p."_createdDate",
      COUNT(DISTINCT ab."_id") as "totalSesiones",
      COUNT(DISTINCT ab."_id") FILTER (WHERE ab."asistio" = true) as "sesionesAsistidas"
    FROM "PEOPLE" p
    LEFT JOIN "ACADEMICA" a ON a."numeroId" = p."numeroId"
    LEFT JOIN "ACADEMICA_BOOKINGS" ab
      ON ab."idEstudiante" = a."_id" OR ab."studentId" = a."_id"
      OR ab."idEstudiante" = p."_id" OR ab."studentId" = p."_id"
    LEFT JOIN "CALENDARIO" c ON COALESCE(ab."eventoId", ab."idEvento") = c."_id"
      AND c."dia" >= $1::timestamp with time zone
      AND c."dia" <= $2::timestamp with time zone
    WHERE p."tipoUsuario" = 'BENEFICIARIO'
    GROUP BY p."_id"
    ORDER BY p."primerApellido" ASC, p."primerNombre" ASC`,
    [fechaInicio, fechaFin]
  );

  console.log(`✅ [PostgreSQL] Informe generado: ${result.rowCount} beneficiarios`);

  const beneficiarios = result.rows.map((row: any) => ({
    ...row,
    nombreCompleto: [row.primerNombre, row.segundoNombre, row.primerApellido, row.segundoApellido]
      .filter(Boolean)
      .join(' '),
    totalSesiones: parseInt(row.totalSesiones) || 0,
    sesionesAsistidas: parseInt(row.sesionesAsistidas) || 0
  }));

  return successResponse({
    beneficiarios,
    total: beneficiarios.length,
    source: 'postgres'
  });
});
